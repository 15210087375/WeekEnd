function pad2(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatDateTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(
    d.getHours()
  )}:${pad2(d.getMinutes())}`;
}

module.exports = { formatDateTime, pad2 };
