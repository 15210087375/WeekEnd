/**
 * 云开发门面：未配置 envId 时全部 no-op / 明确报错，不影响本地模式
 */
const cloudConfig = require('../config/cloud');

let inited = false;
let initTried = false;

function getEnvId() {
  return String((cloudConfig && cloudConfig.envId) || '').trim();
}

function isConfigured() {
  return !!getEnvId();
}

function init() {
  if (initTried) return inited;
  initTried = true;
  const envId = getEnvId();
  if (!envId) {
    inited = false;
    return false;
  }
  if (!wx.cloud) {
    console.warn('[cloud] wx.cloud unavailable');
    inited = false;
    return false;
  }
  try {
    wx.cloud.init({
      env: envId,
      traceUser: true
    });
    inited = true;
    return true;
  } catch (e) {
    console.error('[cloud] init failed', e);
    inited = false;
    return false;
  }
}

function isReady() {
  if (!initTried) init();
  return inited;
}

/**
 * 把微信云错误转成可操作中文（-501000 多为函数未部署/环境不一致）
 */
function friendlyCloudError(err, functionName) {
  const raw =
    (err && err.errMsg) ||
    (err && err.message) ||
    (typeof err === 'string' ? err : '') ||
    '';
  const code = err && (err.errCode != null ? err.errCode : err.errcode);
  const text = `${code != null ? code : ''} ${raw}`;

  if (
    text.indexOf('-501000') >= 0 ||
    /FUNCTION_NOT_FOUND|FunctionName|not found|不存在/i.test(text)
  ) {
    return (
      `云函数「${functionName}」未找到。请在开发者工具：` +
      `cloudfunctions → ${functionName} 右键 → 上传并部署（云端安装依赖），` +
      `并确认环境为 ${getEnvId() || '当前云环境'}`
    );
  }
  if (
    text.indexOf('-502005') >= 0 ||
    /collection not exist|DATABASE_COLLECTION|集合不存在/i.test(text)
  ) {
    return '数据库集合未创建。请重新上传部署云函数 wfaSpace，或在云开发控制台→数据库中新建 users、spaces、space_members';
  }
  if (/invalid env|环境|ENVIRONMENT|env not/i.test(text) || text.indexOf('-501002') >= 0) {
    return `云环境无效，请核对 config/cloud.js 的 envId 是否为 ${getEnvId()}`;
  }
  if (/timeout|超时/i.test(text)) {
    return '云函数超时，请稍后重试或查看云函数日志';
  }
  if (raw) return raw.length > 80 ? raw.slice(0, 80) + '…' : raw;
  return '云函数调用失败';
}

/**
 * 调用云函数 wfaSpace
 * @param {string} action
 * @param {object} [payload]
 */
function callSpace(action, payload) {
  if (!isReady()) {
    return Promise.reject(
      new Error('云开发未配置：请在 config/cloud.js 填写 envId 并开通云环境')
    );
  }
  const name = (cloudConfig && cloudConfig.spaceFunction) || 'wfaSpace';
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name,
      data: {
        action,
        ...(payload || {})
      },
      success(res) {
        const result = res.result;
        if (!result) {
          reject(new Error('云函数无返回'));
          return;
        }
        if (result.ok === false) {
          reject(new Error(result.message || '云函数失败'));
          return;
        }
        resolve(result);
      },
      fail(err) {
        reject(new Error(friendlyCloudError(err, name)));
      }
    });
  });
}

module.exports = {
  init,
  isConfigured,
  isReady,
  callSpace,
  getEnvId
};
