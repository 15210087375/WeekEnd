/**
 * 家庭空间会话（客户端）
 * - 未入空间：mode=local，业务数据纯本地
 * - 已入空间：会话缓存在本地；业务同步见 P2+
 * - 有云配置时启动/进入页静默 login，不强制用户点「连接」
 */
const localStore = require('../services/localStore');
const cloud = require('../services/cloud');
const { STORAGE_KEYS } = require('../utils/constants');

const EMPTY = {
  mode: 'local',
  userId: '',
  displayName: '',
  spaceId: '',
  spaceName: '',
  role: '',
  /** eater 我会吃 | cook 我会做 */
  memberTag: '',
  inviteCode: '',
  members: [],
  updatedAt: 0
};

function normalizeMemberTag(raw) {
  return String(raw || '').trim() === 'cook' ? 'cook' : 'eater';
}

/** 进行中的静默登录，避免并发重复打云函数 */
let silentLoginPromise = null;

function loadSession() {
  const raw = localStore.readJson(STORAGE_KEYS.spaceSession, null);
  if (!raw || typeof raw !== 'object') return { ...EMPTY };
  return {
    ...EMPTY,
    ...raw,
    mode: raw.spaceId ? 'space' : 'local',
    members: Array.isArray(raw.members) ? raw.members : []
  };
}

function saveSession(next) {
  const row = {
    ...EMPTY,
    ...next,
    mode: next.spaceId ? 'space' : 'local',
    updatedAt: Date.now()
  };
  localStore.writeJson(STORAGE_KEYS.spaceSession, row);
  return row;
}

function getSession() {
  return loadSession();
}

function isInSpace() {
  const s = loadSession();
  return s.mode === 'space' && !!s.spaceId;
}

function clearToLocal() {
  const cur = loadSession();
  return saveSession({
    ...EMPTY,
    displayName: cur.displayName || '',
    userId: cur.userId || ''
  });
}

function applyRemoteSession(result) {
  const space = result.space || {};
  const me = result.me || {};
  const members = (result.members || []).map((m) => ({
    ...m,
    memberTag: normalizeMemberTag(m.memberTag),
    memberTagLabel: normalizeMemberTag(m.memberTag) === 'cook' ? '我会做' : '我会吃'
  }));
  const memberTag = me.memberTag
    ? normalizeMemberTag(me.memberTag)
    : space.id
      ? 'eater'
      : '';
  return saveSession({
    mode: space.id ? 'space' : 'local',
    userId: result.userId || me.userId || '',
    displayName: me.displayName || result.displayName || '',
    spaceId: space.id || '',
    spaceName: space.name || '',
    role: me.role || '',
    memberTag: space.id ? memberTag : '',
    inviteCode: space.inviteCode || '',
    members
  });
}

function ensureCloud() {
  cloud.init();
  if (!cloud.isReady()) {
    throw new Error('云开发未就绪，请确认已配置环境并上传云函数 wfaSpace');
  }
}

function defaultDisplayName(raw) {
  const s = String(raw || '').trim();
  return s || '用户';
}

function defaultSpaceName(displayName) {
  const n = defaultDisplayName(displayName);
  if (n === '用户') return '我的家庭';
  return `${n}的家`;
}

/**
 * 登录并刷新会话（若已在空间会带回空间信息）
 * @param {{ displayName?: string }} [opts]
 */
function login(opts) {
  ensureCloud();
  const displayName = defaultDisplayName(
    (opts && opts.displayName) || loadSession().displayName
  );
  return cloud.callSpace('login', { displayName }).then((res) => {
    if (res.space && res.space.id) {
      return applyRemoteSession(res);
    }
    const cur = loadSession();
    return saveSession({
      ...cur,
      mode: 'local',
      userId: res.userId || '',
      displayName: res.displayName || displayName || cur.displayName,
      spaceId: '',
      spaceName: '',
      role: '',
      inviteCode: '',
      members: []
    });
  });
}

/**
 * 静默登录：无云配置时直接 resolve，不弹错；失败只打日志
 * @returns {Promise<{ ok: boolean, session: object, reason?: string }>}
 */
function ensureSilentLogin() {
  cloud.init();
  if (!cloud.isConfigured() || !cloud.isReady()) {
    return Promise.resolve({
      ok: false,
      reason: 'not_configured',
      session: loadSession()
    });
  }
  if (silentLoginPromise) return silentLoginPromise;

  silentLoginPromise = login({})
    .then((session) => ({ ok: true, session }))
    .catch((e) => {
      silentLoginPromise = null;
      console.warn('[space] silent login failed', e);
      return {
        ok: false,
        reason: (e && e.message) || 'login_failed',
        session: loadSession()
      };
    });
  return silentLoginPromise;
}

/**
 * 一键创建家庭（自动空间名）
 * @param {{ name?: string, displayName?: string }} [input]
 */
function createFamily(input) {
  const displayName = defaultDisplayName(
    (input && input.displayName) || loadSession().displayName
  );
  const memberTag = normalizeMemberTag(input && input.memberTag);
  const name =
    String((input && input.name) || '').trim() || defaultSpaceName(displayName);
  return ensureSilentLogin().then((r) => {
    if (!cloud.isReady()) {
      return Promise.reject(
        new Error('云开发未就绪，请确认已上传云函数 wfaSpace')
      );
    }
    if (!r.ok) {
      return login({ displayName }).then(() =>
        createSpace({ name, displayName, memberTag })
      );
    }
    return createSpace({ name, displayName, memberTag });
  });
}

/**
 * 创建空间（同时仅允许 1 个；服务端校验）
 * @param {{ name: string, displayName?: string }} input
 */
function createSpace(input) {
  ensureCloud();
  const displayName = defaultDisplayName(
    (input && input.displayName) || loadSession().displayName
  );
  const name =
    String((input && input.name) || '').trim() || defaultSpaceName(displayName);
  const memberTag = normalizeMemberTag(input && input.memberTag);
  return cloud
    .callSpace('create', { name, displayName, memberTag })
    .then(applyRemoteSession)
    .then((session) => {
      // 创建后：本机数据上传到空间，再拉齐
      try {
        const sync = require('./sync');
        return sync.fullSync({ uploadLocal: true }).then(() => session);
      } catch (e) {
        return session;
      }
    });
}

/**
 * 加入空间
 * @param {{ inviteCode: string, displayName?: string, memberTag?: string }} input
 */
function joinSpace(input) {
  ensureCloud();
  const inviteCode = String((input && input.inviteCode) || '')
    .trim()
    .toUpperCase();
  if (!inviteCode) return Promise.reject(new Error('请填写邀请码'));
  const displayName = defaultDisplayName(
    (input && input.displayName) || loadSession().displayName
  );
  const memberTag = normalizeMemberTag(input && input.memberTag);
  return ensureSilentLogin()
    .then(() =>
      cloud.callSpace('join', {
        inviteCode,
        displayName,
        memberTag
      })
    )
    .then(applyRemoteSession)
    .then((session) => {
      // 加入后：以云端为准合并到本机（先不整包覆盖上传，避免冲掉家庭菜单）
      try {
        const sync = require('./sync');
        return sync.refresh({ reason: 'join', force: true }).then(() => session);
      } catch (e) {
        return session;
      }
    });
}

function refreshSpace() {
  ensureCloud();
  return cloud.callSpace('get').then((res) => {
    if (!res.space || !res.space.id) {
      return clearToLocal();
    }
    return applyRemoteSession(res);
  });
}

function leaveSpace() {
  ensureCloud();
  return cloud.callSpace('leave').then(() => clearToLocal());
}

function transferOwner(toUserId) {
  ensureCloud();
  if (!toUserId) return Promise.reject(new Error('请选择新主账号'));
  return cloud.callSpace('transfer', { toUserId }).then(applyRemoteSession);
}

function kickMember(userId) {
  ensureCloud();
  if (!userId) return Promise.reject(new Error('请选择成员'));
  return cloud.callSpace('kick', { userId }).then(applyRemoteSession);
}

function dissolveSpace() {
  ensureCloud();
  return cloud.callSpace('dissolve').then(() => clearToLocal());
}

function cloudStatus() {
  cloud.init();
  return {
    configured: cloud.isConfigured(),
    ready: cloud.isReady(),
    envId: cloud.getEnvId()
  };
}

/** 我的页等展示用 */
function getStatusSummary() {
  const s = loadSession();
  const st = cloudStatus();
  if (s.spaceId) {
    const tagLabel = s.memberTag === 'cook' ? '我会做' : '我会吃';
    return {
      inSpace: true,
      title: s.spaceName || '家庭空间',
      subtitle:
        (s.role === 'owner' ? '主账号' : '成员') +
        ' · ' +
        tagLabel +
        ' · 点此管理',
      tagText: '已加入',
      tagType: 'space',
      memberTag: s.memberTag || 'eater'
    };
  }
  return {
    inSpace: false,
    title: '仅本机',
    subtitle: st.configured
      ? '可创建或加入家庭，与家人共享'
      : '数据仅保存在本机',
    tagText: '仅本机',
    tagType: 'local',
    memberTag: ''
  };
}

/**
 * 更新自己的身份标签（我会吃 / 我会做）
 */
function setMemberTag(memberTag) {
  ensureCloud();
  const tag = normalizeMemberTag(memberTag);
  return cloud
    .callSpace('setMemberTag', { memberTag: tag })
    .then(applyRemoteSession);
}

/** 是否厨师（我会做）；单人模式视为可操作全部 */
function isCook() {
  if (!isInSpace()) return true;
  return normalizeMemberTag(loadSession().memberTag) === 'cook';
}

/** 是否顾客（我会吃且非厨师） */
function isEaterOnly() {
  if (!isInSpace()) return false;
  return normalizeMemberTag(loadSession().memberTag) === 'eater';
}

module.exports = {
  getSession,
  isInSpace,
  clearToLocal,
  login,
  ensureSilentLogin,
  createFamily,
  createSpace,
  joinSpace,
  refreshSpace,
  leaveSpace,
  transferOwner,
  kickMember,
  dissolveSpace,
  setMemberTag,
  isCook,
  isEaterOnly,
  normalizeMemberTag,
  cloudStatus,
  getStatusSummary,
  defaultDisplayName,
  defaultSpaceName
};
