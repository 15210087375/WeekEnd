const OP_WORDS = [
  { keys: ['大于等于', '不少于', '至少', '及以上'], op: 'gte' },
  { keys: ['小于等于', '不高于', '不超过', '及以下'], op: 'lte' },
  { keys: ['大于', '高于', '超过', '以上'], op: 'gt' },
  { keys: ['小于', '低于', '以下'], op: 'lt' },
  { keys: ['等于', '刚好'], op: 'eq' }
];

const FILLERS = [
  '的菜谱',
  '的美食',
  '的餐厅',
  '的门店',
  '的店',
  '的菜',
  '帮我找',
  '请搜索',
  '搜索',
  '查找',
  '一下'
];

function labelOf(op, value) {
  const map = {
    gt: '大于',
    gte: '不低于',
    lt: '小于',
    lte: '不高于',
    eq: '等于'
  };
  return `评分${map[op] || ''}${value}`;
}

function parseScoreQuery(raw) {
  let text = String(raw || '').trim();
  const hits = [];
  if (!text) return { hits, rest: '' };

  const opAlt = OP_WORDS.map((x) => x.keys.join('|')).join('|');
  const re = new RegExp(
    `(?:评分|分数|打分)?\\s*(${opAlt})\\s*(\\d+(?:\\.\\d+)?)\\s*分?|(\\d+(?:\\.\\d+)?)\\s*分\\s*(以上|以下|及以上|及以下)?`,
    'g'
  );

  text = text.replace(re, (m, opWord, n1, n2, tail) => {
    let op = 'gte';
    let value = Number(n1 != null ? n1 : n2);
    if (!Number.isFinite(value)) return m;
    if (opWord) {
      const found = OP_WORDS.find((x) => x.keys.indexOf(opWord) >= 0);
      op = found ? found.op : 'gt';
    } else if (tail === '以下' || tail === '及以下') {
      op = tail === '及以下' ? 'lte' : 'lt';
    } else if (tail === '以上' || tail === '及以上' || !tail) {
      op = tail === '及以上' || !tail ? 'gte' : 'gt';
    }
    hits.push({
      op,
      value,
      raw: m,
      label: labelOf(op, value)
    });
    return ' ';
  });

  FILLERS.forEach((w) => {
    if (text.indexOf(w) >= 0) text = text.split(w).join(' ');
  });

  return {
    hits,
    rest: text.replace(/\s+/g, ' ').trim()
  };
}

function matchScore(score, hits) {
  if (!hits || !hits.length) return true;
  if (score == null || score === '') return false;
  const n = Number(score);
  if (!Number.isFinite(n)) return false;
  return hits.every((h) => {
    if (h.op === 'gt') return n > h.value;
    if (h.op === 'gte') return n >= h.value;
    if (h.op === 'lt') return n < h.value;
    if (h.op === 'lte') return n <= h.value;
    if (h.op === 'eq') return n === h.value;
    return true;
  });
}

module.exports = {
  parseScoreQuery,
  matchScore
};
