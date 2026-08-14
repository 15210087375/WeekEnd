function isHalfStepScore(score) {
  if (score === null || score === undefined) return true;
  if (typeof score !== 'number' || Number.isNaN(score)) return false;
  if (score < 0 || score > 5) return false;
  return Math.abs(score * 2 - Math.round(score * 2)) < 1e-9;
}

function normalizeTags(input) {
  if (Array.isArray(input)) {
    return input.map((t) => String(t).trim()).filter(Boolean);
  }
  if (typeof input === 'string') {
    return input
      .split(/[,，、\s]+/)
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeLines(input) {
  if (Array.isArray(input)) {
    return input.map((t) => String(t).trim()).filter(Boolean);
  }
  if (typeof input === 'string') {
    return input
      .split(/\n+/)
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
}

module.exports = {
  isHalfStepScore,
  normalizeTags,
  normalizeLines
};
