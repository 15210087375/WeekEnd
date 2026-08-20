/**
 * 同步闸：先本地、少拉网、成功才记时间。
 * 定稿见 docs/SYNC.md
 */
const localStore = require('../services/localStore');
const { STORAGE_KEYS } = require('../utils/constants');

const MINUTE = 60 * 1000;

const BUCKET = {
  menu: {
    types: ['region', 'mall', 'place', 'dish'],
    intervalMs: 3 * MINUTE
  },
  fun: {
    types: ['wish', 'cinema', 'cinemaHall', 'moviePlan', 'movieLog', 'shopLog', 'note', 'schedule'],
    intervalMs: 3 * MINUTE
  },
  order: {
    types: ['order'],
    intervalMs: 15 * 1000
  }
};

const LAUNCH_BUCKETS = ['menu', 'fun'];
const LAUNCH_INTERVAL_MS = 1 * MINUTE;

const TYPE_LIST = {
  region: 'regions',
  mall: 'malls',
  place: 'places',
  dish: 'dishes',
  order: 'orders',
  wish: 'wishes',
  cinema: 'cinemas',
  cinemaHall: 'cinemaHalls',
  moviePlan: 'moviePlans',
  movieLog: 'movieLogs',
  shopLog: 'shopLogs',
  note: 'notes',
  schedule: 'schedules'
};

const IMAGE_TYPES = {
  dish: true,
  wish: true,
  cinema: true,
  cinemaHall: true,
  moviePlan: true,
  movieLog: true,
  shopLog: true,
  note: true,
  schedule: true
};

function emptyMeta() {
  return { launchAt: 0, buckets: { menu: 0, fun: 0, order: 0 } };
}

function loadMeta() {
  const raw = localStore.readJson(STORAGE_KEYS.syncMeta, null);
  const base = emptyMeta();
  if (!raw || typeof raw !== 'object') return base;
  base.launchAt = Number(raw.launchAt) || 0;
  const b = raw.buckets || {};
  base.buckets.menu = Number(b.menu) || 0;
  base.buckets.fun = Number(b.fun) || 0;
  base.buckets.order = Number(b.order) || 0;
  return base;
}

function saveMeta(meta) {
  localStore.writeJson(STORAGE_KEYS.syncMeta, {
    launchAt: meta.launchAt || 0,
    buckets: {
      menu: (meta.buckets && meta.buckets.menu) || 0,
      fun: (meta.buckets && meta.buckets.fun) || 0,
      order: (meta.buckets && meta.buckets.order) || 0
    }
  });
}

function typesOf(bucketIds) {
  const set = {};
  (bucketIds || []).forEach((id) => {
    const b = BUCKET[id];
    if (!b) return;
    b.types.forEach((t) => {
      set[t] = true;
    });
  });
  return Object.keys(set);
}

/**
 * @param {{ reason?: string, buckets?: string[], force?: boolean }} opts
 * @returns {{ pull: boolean, reason: string, buckets: string[] }}
 */
function decide(opts) {
  const force = !!(opts && (opts.force || opts.reason === 'manual' || opts.reason === 'join'));
  const reason = (opts && opts.reason) || 'tab';
  let wanted = (opts && opts.buckets && opts.buckets.length
    ? opts.buckets
    : reason === 'launch'
      ? LAUNCH_BUCKETS.slice()
      : []
  ).filter((id) => BUCKET[id]);

  if (force) {
    if (!wanted.length) wanted = ['menu', 'fun', 'order'];
    return { pull: true, reason: 'force', buckets: wanted };
  }

  if (reason === 'launch') {
    const meta = loadMeta();
    if (Date.now() - (meta.launchAt || 0) < LAUNCH_INTERVAL_MS) {
      return { pull: false, reason: 'launch_cd', buckets: [] };
    }
    return { pull: true, reason: 'launch', buckets: LAUNCH_BUCKETS.slice() };
  }

  const meta = loadMeta();
  const now = Date.now();
  const due = wanted.filter((id) => {
    const last = (meta.buckets && meta.buckets[id]) || 0;
    return now - last >= BUCKET[id].intervalMs;
  });
  if (!due.length) {
    return { pull: false, reason: 'bucket_cd', buckets: [] };
  }
  return { pull: true, reason: 'tab', buckets: due };
}

function markSuccess(bucketIds, stampLaunch) {
  const meta = loadMeta();
  const t = Date.now();
  (bucketIds || []).forEach((id) => {
    if (BUCKET[id]) meta.buckets[id] = t;
  });
  if (stampLaunch) meta.launchAt = t;
  saveMeta(meta);
}

/** 备份导入后：视本地为新真相，短期内不拉网冲掉 */
function stampAllNow() {
  markSuccess(['menu', 'fun', 'order'], true);
}

function fingerprint(cache, types) {
  return (types || [])
    .map((type) => {
      const key = TYPE_LIST[type];
      const list = (cache && key && cache[key]) || [];
      const sig = list
        .filter((r) => r && r.id)
        .map((r) => `${r.id}:${r.updatedAt || 0}`)
        .sort()
        .join(',');
      return `${type}:${list.length}:${sig}`;
    })
    .join('|');
}

function listKey(type) {
  return TYPE_LIST[type];
}

function keepImages(type) {
  return !!IMAGE_TYPES[type];
}

module.exports = {
  BUCKET,
  LAUNCH_BUCKETS,
  TYPE_LIST,
  decide,
  typesOf,
  markSuccess,
  stampAllNow,
  fingerprint,
  listKey,
  keepImages,
  loadMeta
};
