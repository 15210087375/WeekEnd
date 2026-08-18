/**
 * 娱乐 Tab 内的二级层栈。挂在 fun 页上时走层，否则 switchTab 过去再推。
 */
let host = null;

function attach(page) {
  host = page;
}

function detach(page) {
  if (host === page) host = null;
}

function canUse() {
  return !!(host && typeof host.pushFunLayer === 'function');
}

function push(name, params, title) {
  if (!canUse()) return false;
  host.pushFunLayer(name, params || {}, title || '');
  return true;
}

function pop() {
  if (!canUse()) return false;
  return host.popFunLayer();
}

function replace(name, params, title) {
  if (!canUse()) return false;
  host.replaceFunLayer(name, params || {}, title || '');
  return true;
}

function openOrSwitch(name, params, title) {
  if (push(name, params, title)) return;
  try {
    const app = getApp();
    if (app && app.globalData) {
      app.globalData.pendingFunLayer = { name, params: params || {}, title: title || '' };
    }
  } catch (e) {
    // ignore
  }
  wx.switchTab({ url: '/pages/fun/index' });
}

module.exports = {
  attach,
  detach,
  canUse,
  push,
  pop,
  replace,
  openOrSwitch
};
