function now() {
  return Date.now();
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function sortBySortThenName(a, b) {
  const sa = a.sort || 0;
  const sb = b.sort || 0;
  if (sa !== sb) return sa - sb;
  return String(a.name || '').localeCompare(String(b.name || ''), 'zh');
}

module.exports = {
  now,
  clone,
  sortBySortThenName
};
