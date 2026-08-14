/**
 * 领域写入后挂钩同步，避免各实体文件互相循环依赖过重
 */
function afterSave(type, record) {
  try {
    const sync = require('./sync');
    sync.scheduleUpsert(type, record, false);
  } catch (e) {
    console.warn('[syncHook] afterSave', e);
  }
}

function afterRemove(type, id) {
  try {
    const sync = require('./sync');
    sync.scheduleUpsert(
      type,
      { id, updatedAt: Date.now() },
      true
    );
  } catch (e) {
    console.warn('[syncHook] afterRemove', e);
  }
}

module.exports = { afterSave, afterRemove };
