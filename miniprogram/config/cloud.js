/**
 * 微信云开发配置
 *
 * 使用步骤：
 * 1. 微信开发者工具 → 云开发 → 开通环境，复制环境 ID
 * 2. 将 envId 填到下方（非空后客户端才会 init 云）
 * 3. 上传并部署 cloudfunctions/wfaSpace
 * 4. 控制台创建集合：users、spaces、space_members（或由云函数首次写入自动建）
 *
 * envId 为空时：家庭空间云能力不可用，仅本机 + 文件备份正常。
 */
module.exports = {
  /** 云环境 ID，例如 'cloud1-xxx' */
  envId: 'cloud1-d8gkaydlc6788f7b9',
  /** 云函数名 */
  spaceFunction: 'wfaSpace'
};
