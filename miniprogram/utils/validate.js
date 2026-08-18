const { isScore10 } = require('./score');

function isHalfStepScore(score) {
  return isScore10(score);
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
