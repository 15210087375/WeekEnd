/**
 * 家庭空间业务数据同步
 * 页面只调 refresh；闸与指纹见 syncPolicy / docs/SYNC.md
 */
const cache = require('./cache');
const space = require('./space');
const cloud = require('../services/cloud');
const localStore = require('../services/localStore');
const policy = require('./syncPolicy');
const { normalizeCategory } = require('../config/categories');

const QUEUE_KEY = 'wfa:syncQueue';

let pulling = false;
let pushTimer = null;

function canSync() {
  try {
    cloud.init();
    return space.isInSpace() && cloud.isReady();
  } catch (e) {
    return false;
  }
}

function loadQueue() {
  const q = localStore.readJson(QUEUE_KEY, null);
  return Array.isArray(q) ? q : [];
}

function saveQueue(list) {
  localStore.writeJson(QUEUE_KEY, list || []);
}

function enqueue(item) {
  const q = loadQueue();
  // 同 type+id 只保留最新
  const key = `${item.type}:${item.entityId}`;
  const next = q.filter((x) => `${x.type}:${x.entityId}` !== key);
  next.push(item);
  // 上限
  while (next.length > 100) next.shift();
  saveQueue(next);
}

/**
 * 本地变更后调用（异步推送）
 */
function scheduleUpsert(type, record, deleted) {
  if (!canSync()) return;
  if (!record || !record.id) return;
  const entityId = String(record.id);
  const payload = {
    type,
    entityId,
    deleted: !!deleted,
    record: deleted
      ? { id: entityId, updatedAt: record.updatedAt || Date.now() }
      : stripForPush(type, record),
    ts: Date.now()
  };
  enqueue(payload);
  // 立即尝试一条
  flushQueue().catch((e) => console.warn('[sync] flush', e));
}

function stripForPush(type, record) {
  const data = JSON.parse(JSON.stringify(record));
  if (policy.keepImages(type)) data.images = [];
  delete data.statusLabel;
  delete data.priceText;
  delete data.bestRowText;
  delete data.hallSummary;
  delete data.halls;
  delete data.hallCount;
  delete data.thumb;
  delete data.placeText;
  delete data.costText;
  delete data.scoreText;
  delete data.displayTitle;
  delete data.itemText;
  delete data.amountText;
  delete data.categoryLabel;
  delete data.tagLabel;
  delete data.linkedLogId;
  delete data.cinemaName;
  delete data.hallName;
  delete data._syncUpdatedBy;
  return data;
}

function flushQueue() {
  if (!canSync()) return Promise.resolve({ flushed: 0 });
  const q = loadQueue();
  if (!q.length) return Promise.resolve({ flushed: 0 });

  const batch = q.slice(0, 40);
  const rest = q.slice(40);
  return cloud
    .callSpace('syncPushBatch', {
      items: batch.map((x) => ({
        type: x.type,
        record: x.record,
        deleted: x.deleted,
        entityId: x.entityId
      }))
    })
    .then((res) => {
      saveQueue(rest);
      if (rest.length) {
        return flushQueue();
      }
      return { flushed: (res && res.count) || batch.length };
    })
    .catch((e) => {
      console.warn('[sync] push batch failed', e);
      return { flushed: 0, error: e };
    });
}

function mergeEntityList(localList, remoteList, opts) {
  const keepImages = opts && opts.keepImages;
  const map = {};
  (localList || []).forEach((row) => {
    if (row && row.id) map[row.id] = row;
  });

  (remoteList || []).forEach((remote) => {
    if (!remote || !remote.id) return;
    const id = remote.id;
    if (remote.deletedAt) {
      const local = map[id];
      if (!local || (remote.updatedAt || 0) >= (local.updatedAt || 0)) {
        delete map[id];
      }
      return;
    }
    const local = map[id];
    if (!local || (remote.updatedAt || 0) >= (local.updatedAt || 0)) {
      const next = { ...remote };
      if (keepImages && local && local.images && local.images.length) {
        if (!next.images || !next.images.length) {
          next.images = local.images;
        }
      }
      if (next.category) next.category = normalizeCategory(next.category);
      map[id] = next;
    }
  });

  return Object.keys(map).map((k) => map[k]);
}

/**
 * 从云端拉取并合并到本地（不推进 CD；由 refresh 决定）
 */
function pull(options) {
  if (!canSync()) {
    return Promise.resolve({ ok: false, reason: 'not_shared', changed: false });
  }
  if (pulling) {
    return Promise.resolve({ ok: false, reason: 'busy', changed: false });
  }
  pulling = true;
  const types = (options && options.types) || undefined;
  const typed = types && types.length ? types : Object.keys(policy.TYPE_LIST);
  const fpBefore = policy.fingerprint(cache.ensure(), typed);

  return cloud
    .callSpace('syncPull', { types })
    .then((res) => {
      const c = cache.ensure();
      typed.forEach((type) => {
        const key = policy.listKey(type);
        if (!key) return;
        const remote = res[key];
        if (!Array.isArray(remote)) return;
        c[key] = mergeEntityList(c[key], remote, {
          keepImages: policy.keepImages(type)
        });
      });
      (c.dishes || []).forEach((d) => {
        d.category = normalizeCategory(d.category);
      });
      const fpAfter = policy.fingerprint(c, typed);
      const changed = fpBefore !== fpAfter;
      if (changed) {
        cache.setAll(c);
        cache.persistAll();
        try {
          require('./dish').purgeHomemadeNameDupes();
        } catch (e) {
          // ignore
        }
      }
      return { ok: true, changed, serverTime: res.serverTime };
    })
    .catch((e) => {
      console.warn('[sync] pull failed', e);
      return { ok: false, changed: false, error: (e && e.message) || '同步失败' };
    })
    .then((r) => {
      pulling = false;
      return r;
    });
}

/**
 * 把本机全量业务推到云（加入/创建家庭后调用）
 */
function pushAll() {
  if (!canSync()) {
    return Promise.resolve({ ok: false, reason: 'not_shared' });
  }
  const c = cache.ensure();
  const items = [];
  function addAll(type, list) {
    (list || []).forEach((row) => {
      if (!row || !row.id) return;
      items.push({
        type,
        record: stripForPush(type, row),
        deleted: false
      });
    });
  }
  Object.keys(policy.TYPE_LIST).forEach((type) => {
    addAll(type, c[policy.listKey(type)]);
  });

  // 分批
  const chunks = [];
  for (let i = 0; i < items.length; i += 40) {
    chunks.push(items.slice(i, i + 40));
  }

  let chain = Promise.resolve({ count: 0 });
  chunks.forEach((chunk) => {
    chain = chain.then((acc) =>
      cloud.callSpace('syncPushBatch', { items: chunk }).then((res) => ({
        count: acc.count + ((res && res.count) || chunk.length)
      }))
    );
  });
  return chain
    .then((r) => ({ ok: true, count: r.count }))
    .catch((e) => {
      console.warn('[sync] pushAll failed', e);
      return { ok: false, error: (e && e.message) || '上传失败' };
    });
}

/**
 * 进入家庭后：先推本机（可选）再拉
 */
function fullSync(opts) {
  const uploadLocal = !opts || opts.uploadLocal !== false;
  if (!canSync()) {
    return Promise.resolve({ ok: false, reason: 'not_shared' });
  }
  const start = uploadLocal ? pushAll() : Promise.resolve({ ok: true });
  return start.then((up) =>
    pull().then((down) => {
      if (down && down.ok) policy.markSuccess(['menu', 'fun', 'order'], true);
      return {
        ok: !!(down && down.ok),
        changed: !!(down && down.changed),
        upload: up,
        download: down
      };
    })
  );
}

/**
 * 页面唯一入口。
 * @param {{ reason?: 'launch'|'tab'|'manual'|'join', buckets?: string[], force?: boolean }} [options]
 */
function refresh(options) {
  if (!canSync()) {
    return Promise.resolve({
      ok: false,
      skipped: true,
      reason: 'not_shared',
      changed: false
    });
  }
  const gate = policy.decide(options || {});
  if (!gate.pull) {
    return Promise.resolve({
      ok: true,
      skipped: true,
      reason: gate.reason,
      changed: false,
      buckets: []
    });
  }
  const types = policy.typesOf(gate.buckets);
  return pull({ types }).then((down) => {
    if (down && down.ok) {
      policy.markSuccess(gate.buckets, gate.reason === 'launch');
    }
    return {
      ok: !!(down && down.ok),
      skipped: false,
      reason: gate.reason,
      changed: !!(down && down.changed),
      buckets: gate.buckets,
      error: down && down.error
    };
  });
}

module.exports = {
  canSync,
  scheduleUpsert,
  flushQueue,
  pull,
  refresh,
  pushAll,
  fullSync
};
