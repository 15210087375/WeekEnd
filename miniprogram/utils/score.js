/** 10 分制：半星 = 1，整星 = 2，取值 0–10 整数 */

function parseScore10(raw, nullable) {
  if (raw === '' || raw === null || raw === undefined) {
    return nullable ? null : 0;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return nullable ? null : 0;
  return Math.min(10, Math.max(0, Math.round(n)));
}

function isScore10(score) {
  if (score === null || score === undefined) return true;
  if (typeof score !== 'number' || Number.isNaN(score)) return false;
  if (score < 0 || score > 10) return false;
  return Math.abs(score - Math.round(score)) < 1e-9;
}

function scaleLegacy5to10(raw) {
  if (raw === '' || raw === null || raw === undefined) return raw;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return raw === 0 || n === 0 ? 0 : raw;
  return Math.min(10, Math.round(n * 2));
}

module.exports = {
  parseScore10,
  isScore10,
  scaleLegacy5to10
};
