/**
 * 家庭空间云函数（P1）
 * action: login | create | join | get | leave | transfer | kick | dissolve
 */
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const MAX_MEMBERS = 5;
const COL = {
  users: 'users',
  spaces: 'spaces',
  members: 'space_members',
  carts: 'space_carts',
  /** 业务实体同步 */
  docs: 'space_docs'
};

const SYNC_TYPES = {
  region: true,
  mall: true,
  place: true,
  dish: true,
  order: true,
  wish: true,
  cinema: true,
  cinemaHall: true,
  moviePlan: true,
  movieLog: true,
  shopLog: true,
  note: true
};

const TYPE_FIELD = {
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
  note: 'notes'
};

const IMAGE_TYPES = {
  dish: true,
  wish: true,
  cinema: true,
  cinemaHall: true,
  moviePlan: true,
  movieLog: true,
  shopLog: true,
  note: true
};

function ok(data) {
  return { ok: true, ...data };
}

function fail(message) {
  return { ok: false, message: message || '失败' };
}

function now() {
  return Date.now();
}

function makeInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) {
    s += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return s;
}

/**
 * 首次使用自动建集合（-502005 集合不存在）
 * 已存在时 createCollection 会失败，忽略即可
 */
async function ensureCollections() {
  const names = [COL.users, COL.spaces, COL.members, COL.carts, COL.docs];
  for (let i = 0; i < names.length; i++) {
    try {
      await db.createCollection(names[i]);
    } catch (e) {
      // 已存在 / 无权限创建时忽略，后续操作再报真实错误
    }
  }
}

function docKey(spaceId, type, entityId) {
  // 云数据库 _id 限制，用短连接
  return `${spaceId}_${type}_${entityId}`.slice(0, 128);
}

function sanitizeRecord(type, record) {
  if (!record || typeof record !== 'object') return null;
  const data = JSON.parse(JSON.stringify(record));
  // 本地路径对其他设备无效，不同步图片文件
  if (IMAGE_TYPES[type]) {
    data.images = [];
  }
  return data;
}

async function queryAllDocs(spaceId, type) {
  const col = db.collection(COL.docs);
  const all = [];
  let skip = 0;
  const limit = 20;
  for (let i = 0; i < 50; i++) {
    const res = await col
      .where({ spaceId, type })
      .skip(skip)
      .limit(limit)
      .get();
    const batch = res.data || [];
    all.push.apply(all, batch);
    if (batch.length < limit) break;
    skip += limit;
  }
  return all;
}

/**
 * 拉取空间业务数据（菜单 / 点餐 / 心愿）
 * 私密心愿仅创建者可见
 */
async function actionSyncPull(openid, event) {
  const gate = await requireSpaceMember(openid);
  if (gate.error) return gate.error;
  const userId = gate.user._id;
  const spaceId = gate.spaceId;
  const types = Array.isArray(event.types) && event.types.length
    ? event.types.filter((t) => SYNC_TYPES[t])
    : Object.keys(SYNC_TYPES);

  const result = { serverTime: now() };
  Object.keys(TYPE_FIELD).forEach((t) => {
    result[TYPE_FIELD[t]] = [];
  });

  for (let i = 0; i < types.length; i++) {
    const type = types[i];
    const field = TYPE_FIELD[type];
    if (!field) continue;
    const rows = await queryAllDocs(spaceId, type);
    rows.forEach((row) => {
      if (!row || !row.data) return;
      if (row.deletedAt) {
        result[field].push({
          id: row.entityId,
          deletedAt: row.deletedAt,
          updatedAt: row.updatedAt || row.deletedAt
        });
        return;
      }
      const data = row.data;
      data.id = data.id || row.entityId;
      data.updatedAt = row.updatedAt || data.updatedAt;
      data._syncUpdatedBy = row.updatedBy || '';

      if (type === 'wish' || type === 'shopLog' || type === 'note') {
        const vis = data.visibility === 'private' ? 'private' : 'space';
        if (vis === 'private' && data.createdBy && data.createdBy !== userId) {
          return;
        }
      }

      result[field].push(data);
    });
  }

  return ok({ spaceId, ...result });
}

/**
 * 单条 upsert / 软删
 * event: { type, record, deleted? }
 */
async function actionSyncUpsert(openid, event) {
  const gate = await requireSpaceMember(openid);
  if (gate.error) return gate.error;
  const type = event.type;
  if (!SYNC_TYPES[type]) return fail('无效类型');
  const record = event.record || {};
  const entityId = String(record.id || event.entityId || '');
  if (!entityId) return fail('缺少实体 id');

  const t = now();
  const deleted = !!event.deleted;
  const data = deleted ? { id: entityId } : sanitizeRecord(type, record);
  if (!deleted && !data) return fail('记录无效');

  if (!deleted && (type === 'wish' || type === 'shopLog' || type === 'note')) {
    data.createdBy = data.createdBy || gate.user._id;
    const existing = await readOneDoc(gate.spaceId, type, entityId);
    if (
      existing &&
      existing.data &&
      existing.data.visibility === 'private' &&
      existing.data.createdBy &&
      existing.data.createdBy !== gate.user._id
    ) {
      return fail('无权修改他人的私密记录');
    }
  }

  const payload = {
    spaceId: gate.spaceId,
    type,
    entityId,
    data: deleted ? { id: entityId } : data,
    updatedAt: t,
    updatedBy: gate.user._id,
    deletedAt: deleted ? t : null
  };

  const _id = docKey(gate.spaceId, type, entityId);
  try {
    await db.collection(COL.docs).doc(_id).set({ data: payload });
  } catch (e) {
    try {
      await db.collection(COL.docs).add({
        data: { _id, ...payload }
      });
    } catch (e2) {
      await db.collection(COL.docs).doc(_id).update({
        data: {
          data: payload.data,
          updatedAt: t,
          updatedBy: gate.user._id,
          deletedAt: payload.deletedAt
        }
      });
    }
  }

  return ok({
    type,
    entityId,
    updatedAt: t,
    deleted
  });
}

async function readOneDoc(spaceId, type, entityId) {
  const _id = docKey(spaceId, type, entityId);
  try {
    const res = await db.collection(COL.docs).doc(_id).get();
    return res.data || null;
  } catch (e) {
    return null;
  }
}

/**
 * 批量推送（创建家庭后上传本机菜单等）
 * event: { items: [{ type, record, deleted? }] }
 */
async function actionSyncPushBatch(openid, event) {
  const gate = await requireSpaceMember(openid);
  if (gate.error) return gate.error;
  const items = Array.isArray(event.items) ? event.items : [];
  if (!items.length) return ok({ count: 0 });
  if (items.length > 80) return fail('单次最多 80 条，请分批');

  let count = 0;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const r = await actionSyncUpsert(openid, {
      type: it.type,
      record: it.record,
      deleted: it.deleted,
      entityId: it.entityId
    });
    if (r && r.ok) count += 1;
  }
  return ok({ count });
}

function normalizeCartItems(list) {
  const out = [];
  const seen = {};
  (list || []).forEach((it) => {
    if (!it || !it.name) return;
    const dishId = it.dishId ? String(it.dishId) : '';
    const key = dishId || `n:${String(it.name).trim()}`;
    if (seen[key]) return;
    seen[key] = true;
    out.push({
      dishId,
      name: String(it.name || '').trim(),
      category: it.category || '',
      categoryLabel: it.categoryLabel || '',
      placeLabel: it.placeLabel || '',
      spicy: it.spicy != null ? it.spicy : null,
      score: it.score != null ? it.score : null,
      kind: it.kind || 'dine_out',
      addedBy: it.addedBy || '',
      addedByName: it.addedByName || ''
    });
  });
  return out;
}

async function readSpaceCart(spaceId) {
  if (!spaceId) return { items: [], updatedAt: 0, updatedBy: '' };
  try {
    const res = await db.collection(COL.carts).doc(spaceId).get();
    const doc = res.data || {};
    return {
      items: normalizeCartItems(doc.items),
      updatedAt: doc.updatedAt || 0,
      updatedBy: doc.updatedBy || ''
    };
  } catch (e) {
    return { items: [], updatedAt: 0, updatedBy: '' };
  }
}

async function writeSpaceCart(spaceId, items, userId) {
  const t = now();
  const payload = {
    spaceId,
    items: normalizeCartItems(items),
    updatedAt: t,
    updatedBy: userId || ''
  };
  try {
    await db.collection(COL.carts).doc(spaceId).set({ data: payload });
  } catch (e) {
    // 部分环境 set 失败时尝试 update + add
    try {
      await db.collection(COL.carts).add({
        data: { _id: spaceId, ...payload }
      });
    } catch (e2) {
      await db.collection(COL.carts).doc(spaceId).update({
        data: {
          items: payload.items,
          updatedAt: t,
          updatedBy: userId || ''
        }
      });
    }
  }
  return payload;
}

async function requireSpaceMember(openid) {
  const user = await ensureUser(openid);
  const spaceId = user.currentSpaceId;
  if (!spaceId) {
    return { error: fail('未加入家庭空间，无法共享点餐') };
  }
  const memRes = await db
    .collection(COL.members)
    .where({ spaceId, userId: user._id, status: 'active' })
    .limit(1)
    .get();
  if (!memRes.data || !memRes.data.length) {
    return { error: fail('你不在该家庭空间中') };
  }
  return { user, spaceId, member: memRes.data[0] };
}

async function actionCartGet(openid) {
  const user = await ensureUser(openid);
  if (!user.currentSpaceId) {
    return ok({ shared: false, items: [], updatedAt: 0 });
  }
  const cart = await readSpaceCart(user.currentSpaceId);
  return ok({
    shared: true,
    items: cart.items,
    updatedAt: cart.updatedAt,
    updatedBy: cart.updatedBy
  });
}

async function actionCartSet(openid, event) {
  const gate = await requireSpaceMember(openid);
  if (gate.error) return gate.error;
  const payload = await writeSpaceCart(
    gate.spaceId,
    event.items || [],
    gate.user._id
  );
  return ok({
    shared: true,
    items: payload.items,
    updatedAt: payload.updatedAt,
    updatedBy: payload.updatedBy
  });
}

async function actionCartAdd(openid, event) {
  const gate = await requireSpaceMember(openid);
  if (gate.error) return gate.error;
  const item = event.item;
  if (!item || !item.name) return fail('菜品无效');
  const cart = await readSpaceCart(gate.spaceId);
  const items = cart.items.slice();
  const dishId = item.dishId ? String(item.dishId) : '';
  const exists = items.some((x) => {
    if (dishId && x.dishId === dishId) return true;
    if (!dishId && x.name === item.name) return true;
    return false;
  });
  if (!exists) {
    items.push({
      ...item,
      dishId,
      addedBy: item.addedBy || gate.user._id,
      addedByName: item.addedByName || gate.user.displayName || '家人'
    });
  }
  const payload = await writeSpaceCart(gate.spaceId, items, gate.user._id);
  return ok({
    shared: true,
    items: payload.items,
    updatedAt: payload.updatedAt,
    updatedBy: payload.updatedBy
  });
}

async function actionCartRemove(openid, event) {
  const gate = await requireSpaceMember(openid);
  if (gate.error) return gate.error;
  const dishId = String(event.dishId || '');
  if (!dishId) return fail('缺少 dishId');
  const cart = await readSpaceCart(gate.spaceId);
  const items = cart.items.filter((x) => String(x.dishId) !== dishId);
  const payload = await writeSpaceCart(gate.spaceId, items, gate.user._id);
  return ok({
    shared: true,
    items: payload.items,
    updatedAt: payload.updatedAt,
    updatedBy: payload.updatedBy
  });
}

async function actionCartClear(openid) {
  const gate = await requireSpaceMember(openid);
  if (gate.error) return gate.error;
  const payload = await writeSpaceCart(gate.spaceId, [], gate.user._id);
  return ok({
    shared: true,
    items: payload.items,
    updatedAt: payload.updatedAt,
    updatedBy: payload.updatedBy
  });
}

async function ensureUser(openid, displayName) {
  const col = db.collection(COL.users);
  let found;
  try {
    found = await col.where({ openid }).limit(1).get();
  } catch (e) {
    const msg = String((e && e.message) || e || '');
    // 集合仍不存在时尝试再建一次后重试
    if (msg.indexOf('502005') >= 0 || /not exist|不存在/i.test(msg)) {
      await ensureCollections();
      found = await col.where({ openid }).limit(1).get();
    } else {
      throw e;
    }
  }
  const t = now();
  if (found.data && found.data.length) {
    const row = found.data[0];
    const patch = { updatedAt: t };
    if (displayName && displayName !== row.displayName) {
      patch.displayName = displayName;
    }
    if (Object.keys(patch).length > 1) {
      await col.doc(row._id).update({ data: patch });
    }
    return {
      _id: row._id,
      openid: row.openid,
      displayName: patch.displayName || row.displayName || '用户',
      currentSpaceId: row.currentSpaceId || ''
    };
  }
  const doc = {
    openid,
    displayName: displayName || '用户',
    currentSpaceId: '',
    createdAt: t,
    updatedAt: t
  };
  const addRes = await col.add({ data: doc });
  return {
    _id: addRes._id,
    openid,
    displayName: doc.displayName,
    currentSpaceId: ''
  };
}

function normalizeMemberTag(raw) {
  return String(raw || '').trim() === 'cook' ? 'cook' : 'eater';
}

async function listMembers(spaceId) {
  const res = await db
    .collection(COL.members)
    .where({ spaceId, status: 'active' })
    .get();
  return (res.data || []).map((m) => ({
    userId: m.userId,
    openid: m.openid,
    displayName: m.displayName || '用户',
    role: m.role,
    memberTag: normalizeMemberTag(m.memberTag),
    joinedAt: m.joinedAt
  }));
}

async function getSpaceDoc(spaceId) {
  if (!spaceId) return null;
  try {
    const res = await db.collection(COL.spaces).doc(spaceId).get();
    return res.data || null;
  } catch (e) {
    return null;
  }
}

async function buildSessionPayload(user) {
  const spaceId = user.currentSpaceId || '';
  if (!spaceId) {
    return ok({
      userId: user._id,
      displayName: user.displayName,
      space: null,
      me: null,
      members: []
    });
  }
  const space = await getSpaceDoc(spaceId);
  if (!space || space.status === 'dissolved') {
    await db.collection(COL.users).doc(user._id).update({
      data: { currentSpaceId: '', updatedAt: now() }
    });
    return ok({
      userId: user._id,
      displayName: user.displayName,
      space: null,
      me: null,
      members: []
    });
  }
  const members = await listMembers(spaceId);
  const me = members.find((m) => m.userId === user._id) || null;
  return ok({
    userId: user._id,
    displayName: user.displayName,
    space: {
      id: space._id,
      name: space.name,
      inviteCode: space.inviteCode,
      ownerId: space.ownerId,
      status: space.status
    },
    me: me
      ? {
          userId: me.userId,
          displayName: me.displayName,
          role: me.role,
          memberTag: me.memberTag || 'eater'
        }
      : null,
    members
  });
}

async function actionLogin(openid, event) {
  const user = await ensureUser(openid, event.displayName);
  return buildSessionPayload(user);
}

async function actionCreate(openid, event) {
  const name = String(event.name || '').trim();
  if (!name) return fail('请填写空间名称');
  const user = await ensureUser(openid, event.displayName);
  if (user.currentSpaceId) {
    return fail('已在一个家庭空间中，请先退出再创建');
  }

  const t = now();
  let inviteCode = makeInviteCode();
  for (let i = 0; i < 5; i++) {
    const exists = await db
      .collection(COL.spaces)
      .where({ inviteCode, status: 'active' })
      .limit(1)
      .get();
    if (!exists.data || !exists.data.length) break;
    inviteCode = makeInviteCode();
  }

  const spaceAdd = await db.collection(COL.spaces).add({
    data: {
      name,
      ownerId: user._id,
      inviteCode,
      status: 'active',
      memberCount: 1,
      createdAt: t,
      updatedAt: t
    }
  });
  const spaceId = spaceAdd._id;

  const memberTag = normalizeMemberTag(event.memberTag);
  await db.collection(COL.members).add({
    data: {
      spaceId,
      userId: user._id,
      openid,
      displayName: user.displayName,
      role: 'owner',
      memberTag,
      status: 'active',
      joinedAt: t,
      updatedAt: t
    }
  });

  await db.collection(COL.users).doc(user._id).update({
    data: { currentSpaceId: spaceId, updatedAt: t }
  });

  user.currentSpaceId = spaceId;
  return buildSessionPayload(user);
}

async function actionJoin(openid, event) {
  const inviteCode = String(event.inviteCode || '')
    .trim()
    .toUpperCase();
  if (!inviteCode) return fail('请填写邀请码');
  const user = await ensureUser(openid, event.displayName);
  if (user.currentSpaceId) {
    return fail('已在一个家庭空间中，请先退出再加入');
  }

  const found = await db
    .collection(COL.spaces)
    .where({ inviteCode, status: 'active' })
    .limit(1)
    .get();
  if (!found.data || !found.data.length) return fail('邀请码无效或空间已解散');
  const space = found.data[0];
  const spaceId = space._id;

  const memRes = await db
    .collection(COL.members)
    .where({ spaceId, status: 'active' })
    .get();
  const active = memRes.data || [];
  if (active.length >= MAX_MEMBERS) return fail(`空间已满（最多 ${MAX_MEMBERS} 人）`);
  if (active.some((m) => m.userId === user._id || m.openid === openid)) {
    return fail('你已在该空间中');
  }

  const t = now();
  const memberTag = normalizeMemberTag(event.memberTag);
  await db.collection(COL.members).add({
    data: {
      spaceId,
      userId: user._id,
      openid,
      displayName: user.displayName,
      role: 'member',
      memberTag,
      status: 'active',
      joinedAt: t,
      updatedAt: t
    }
  });
  await db.collection(COL.spaces).doc(spaceId).update({
    data: {
      memberCount: _.inc(1),
      updatedAt: t
    }
  });
  await db.collection(COL.users).doc(user._id).update({
    data: { currentSpaceId: spaceId, updatedAt: t }
  });
  user.currentSpaceId = spaceId;
  return buildSessionPayload(user);
}

async function actionGet(openid) {
  const user = await ensureUser(openid);
  return buildSessionPayload(user);
}

async function actionLeave(openid) {
  const user = await ensureUser(openid);
  const spaceId = user.currentSpaceId;
  if (!spaceId) return ok({ left: true });

  const memRes = await db
    .collection(COL.members)
    .where({ spaceId, userId: user._id, status: 'active' })
    .limit(1)
    .get();
  const mem = memRes.data && memRes.data[0];
  if (mem && mem.role === 'owner') {
    return fail('主账号请先转让主账号或解散空间后再退出');
  }

  const t = now();
  if (mem) {
    await db.collection(COL.members).doc(mem._id).update({
      data: { status: 'left', updatedAt: t }
    });
    await db.collection(COL.spaces).doc(spaceId).update({
      data: { memberCount: _.inc(-1), updatedAt: t }
    });
  }
  await db.collection(COL.users).doc(user._id).update({
    data: { currentSpaceId: '', updatedAt: t }
  });
  return ok({ left: true });
}

async function actionTransfer(openid, event) {
  const toUserId = event.toUserId;
  if (!toUserId) return fail('请选择新主账号');
  const user = await ensureUser(openid);
  const spaceId = user.currentSpaceId;
  if (!spaceId) return fail('未加入空间');

  const myRes = await db
    .collection(COL.members)
    .where({ spaceId, userId: user._id, status: 'active' })
    .limit(1)
    .get();
  const me = myRes.data && myRes.data[0];
  if (!me || me.role !== 'owner') return fail('仅主账号可转让');

  if (toUserId === user._id) return fail('不能转让给自己');

  const targetRes = await db
    .collection(COL.members)
    .where({ spaceId, userId: toUserId, status: 'active' })
    .limit(1)
    .get();
  const target = targetRes.data && targetRes.data[0];
  if (!target) return fail('目标用户不在空间中');

  const t = now();
  await db.collection(COL.members).doc(me._id).update({
    data: { role: 'member', updatedAt: t }
  });
  await db.collection(COL.members).doc(target._id).update({
    data: { role: 'owner', updatedAt: t }
  });
  await db.collection(COL.spaces).doc(spaceId).update({
    data: { ownerId: toUserId, updatedAt: t }
  });
  return buildSessionPayload(user);
}

async function actionKick(openid, event) {
  const targetUserId = event.userId;
  if (!targetUserId) return fail('请选择成员');
  const user = await ensureUser(openid);
  const spaceId = user.currentSpaceId;
  if (!spaceId) return fail('未加入空间');

  const myRes = await db
    .collection(COL.members)
    .where({ spaceId, userId: user._id, status: 'active' })
    .limit(1)
    .get();
  const me = myRes.data && myRes.data[0];
  if (!me || me.role !== 'owner') return fail('仅主账号可踢人');
  if (targetUserId === user._id) return fail('不能踢出自己，请使用解散或转让');

  const targetRes = await db
    .collection(COL.members)
    .where({ spaceId, userId: targetUserId, status: 'active' })
    .limit(1)
    .get();
  const target = targetRes.data && targetRes.data[0];
  if (!target) return fail('成员不存在');

  const t = now();
  await db.collection(COL.members).doc(target._id).update({
    data: { status: 'kicked', updatedAt: t }
  });
  await db.collection(COL.spaces).doc(spaceId).update({
    data: { memberCount: _.inc(-1), updatedAt: t }
  });
  await db.collection(COL.users).doc(targetUserId).update({
    data: { currentSpaceId: '', updatedAt: t }
  });
  return buildSessionPayload(user);
}

/**
 * 更新自己的身份标签（我会吃 / 我会做）
 */
async function actionSetMemberTag(openid, event) {
  const user = await ensureUser(openid, event.displayName);
  const spaceId = user.currentSpaceId;
  if (!spaceId) return fail('未加入家庭空间');
  const memberTag = normalizeMemberTag(event.memberTag);
  const memRes = await db
    .collection(COL.members)
    .where({ spaceId, userId: user._id, status: 'active' })
    .limit(1)
    .get();
  const mem = memRes.data && memRes.data[0];
  if (!mem) return fail('成员不存在');
  await db.collection(COL.members).doc(mem._id).update({
    data: { memberTag, updatedAt: now() }
  });
  return buildSessionPayload(user);
}

async function actionDissolve(openid) {
  const user = await ensureUser(openid);
  const spaceId = user.currentSpaceId;
  if (!spaceId) return fail('未加入空间');

  const myRes = await db
    .collection(COL.members)
    .where({ spaceId, userId: user._id, status: 'active' })
    .limit(1)
    .get();
  const me = myRes.data && myRes.data[0];
  if (!me || me.role !== 'owner') return fail('仅主账号可解散空间');

  const t = now();
  const members = await db
    .collection(COL.members)
    .where({ spaceId, status: 'active' })
    .get();
  const tasks = (members.data || []).map((m) =>
    db
      .collection(COL.members)
      .doc(m._id)
      .update({ data: { status: 'dissolved', updatedAt: t } })
      .then(() =>
        db.collection(COL.users).doc(m.userId).update({
          data: { currentSpaceId: '', updatedAt: t }
        })
      )
  );
  await Promise.all(tasks);
  await db.collection(COL.spaces).doc(spaceId).update({
    data: { status: 'dissolved', memberCount: 0, updatedAt: t }
  });
  return ok({ dissolved: true });
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) return fail('无法获取用户身份');

  const action = event && event.action;
  try {
    await ensureCollections();
    switch (action) {
      case 'login':
        return await actionLogin(openid, event);
      case 'create':
        return await actionCreate(openid, event);
      case 'join':
        return await actionJoin(openid, event);
      case 'get':
        return await actionGet(openid);
      case 'leave':
        return await actionLeave(openid);
      case 'transfer':
        return await actionTransfer(openid, event);
      case 'kick':
        return await actionKick(openid, event);
      case 'dissolve':
        return await actionDissolve(openid);
      case 'cartGet':
        return await actionCartGet(openid);
      case 'cartSet':
        return await actionCartSet(openid, event);
      case 'cartAdd':
        return await actionCartAdd(openid, event);
      case 'cartRemove':
        return await actionCartRemove(openid, event);
      case 'cartClear':
        return await actionCartClear(openid);
      case 'setMemberTag':
        return await actionSetMemberTag(openid, event);
      case 'syncPull':
        return await actionSyncPull(openid, event);
      case 'syncUpsert':
        return await actionSyncUpsert(openid, event);
      case 'syncPushBatch':
        return await actionSyncPushBatch(openid, event);
      default:
        return fail(`未知 action: ${action}`);
    }
  } catch (e) {
    console.error('[wfaSpace]', action, e);
    return fail((e && e.message) || '服务异常');
  }
};
