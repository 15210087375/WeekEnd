/**
 * 兼容层：历史页面 `require('./services/repository')` 仍可用。
 * 新代码优先：`require('../domain/index')`
 */
module.exports = require('../domain/index');
