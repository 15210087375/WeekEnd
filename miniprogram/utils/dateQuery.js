function pad2(n) {
  return n < 10 ? `0${n}` : String(n);
}

const CN_DIGIT = {
  零: 0,
  〇: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9
};

const WEEKDAY_INDEX = {
  日: 0,
  天: 0,
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6
};

const WEEKDAY_LABEL = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function weekdayOfYmd(ymd) {
  const s = String(ymd || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return -1;
  const d = new Date(`${s.replace(/-/g, '/')} 00:00:00`);
  if (Number.isNaN(d.getTime())) return -1;
  return d.getDay();
}

function ymdFromDate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function ymdOfWeekday(targetDow, weekOffset) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const fromMon = (d.getDay() + 6) % 7;
  const targetFromMon = (targetDow + 6) % 7;
  d.setDate(d.getDate() + (targetFromMon - fromMon) + weekOffset * 7);
  return ymdFromDate(d);
}

const FESTIVALS = [
  { keys: ['八一', '建军'], md: '08-01' },
  { keys: ['国庆'], md: '10-01' },
  { keys: ['元旦'], md: '01-01' },
  { keys: ['五一', '劳动节'], md: '05-01' },
  { keys: ['圣诞'], md: '12-25' }
];

function validMd(m, d) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  if ([4, 6, 9, 11].indexOf(m) >= 0 && d > 30) return false;
  if (m === 2 && d > 29) return false;
  return true;
}

function mdOf(m, d) {
  if (!validMd(m, d)) return '';
  return `${pad2(m)}-${pad2(d)}`;
}

function parseCnNum(raw) {
  const s = String(raw || '');
  if (!s) return NaN;
  if (/^\d+$/.test(s)) return Number(s);
  if (s === '十') return 10;
  if (s === '廿') return 20;
  if (s.charAt(0) === '廿') {
    const n = CN_DIGIT[s.charAt(1)];
    return n != null ? 20 + n : NaN;
  }
  if (s.charAt(0) === '十') {
    const n = CN_DIGIT[s.slice(1)] || 0;
    return 10 + n;
  }
  if (s.indexOf('十') > 0) {
    const a = CN_DIGIT[s.charAt(0)];
    const b = s.length > 2 ? CN_DIGIT[s.charAt(2)] || 0 : 0;
    if (a == null) return NaN;
    return a * 10 + b;
  }
  if (s.length === 1 && CN_DIGIT[s] != null) return CN_DIGIT[s];
  if (s.length === 2 && CN_DIGIT[s[0]] != null && CN_DIGIT[s[1]] != null) {
    return CN_DIGIT[s[0]] * 10 + CN_DIGIT[s[1]];
  }
  return NaN;
}

function addHit(hits, md, raw) {
  if (!md) return;
  if (hits.some((h) => h.md === md && h.raw === raw)) return;
  hits.push({ md, raw, label: labelOf(md) });
}

function labelOf(md) {
  const p = String(md).split('-');
  return `${Number(p[0])}月${Number(p[1])}日`;
}

function ymdOfTs(ts) {
  if (!ts) return '';
  const d = new Date(Number(ts));
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function rowDate(row, fields) {
  const list = fields || ['date', 'mealDate'];
  for (let i = 0; i < list.length; i++) {
    const v = row && row[list[i]];
    if (v == null || v === '') continue;
    if (typeof v === 'number') {
      const ymd = ymdOfTs(v);
      if (ymd) return ymd;
    }
    const s = String(v).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  }
  if (row && row.createdAt) return ymdOfTs(row.createdAt);
  return '';
}

function matchDate(ymd, hits) {
  if (!ymd || !hits || !hits.length) return false;
  const md = ymd.slice(5);
  const full = ymd;
  const dow = weekdayOfYmd(ymd);
  return hits.some((h) => {
    if (h.ymd) return h.ymd === full;
    if (h.md) return h.md === md;
    if (h.weekday != null) return dow === h.weekday;
    return false;
  });
}

/**
 * 从搜索词抽出日期，返回 { hits, rest }
 * hits: { md, ymd?, raw, label }
 */
function parseDateQuery(raw) {
  let text = String(raw || '').trim();
  const hits = [];
  if (!text) return { hits, rest: '' };

  text = text.replace(/(这|上|下)(周|星期|礼拜)([一二三四五六日天])/g, (m, rel, _w, d) => {
    const dow = WEEKDAY_INDEX[d];
    if (dow == null) return m;
    const weekOffset = rel === '上' ? -1 : rel === '下' ? 1 : 0;
    const ymd = ymdOfWeekday(dow, weekOffset);
    hits.push({
      ymd,
      md: ymd.slice(5),
      raw: m,
      label: m
    });
    return ' ';
  });

  text = text.replace(/(周|星期|礼拜)([一二三四五六日天])/g, (m, _w, d) => {
    const dow = WEEKDAY_INDEX[d];
    if (dow == null) return m;
    hits.push({
      weekday: dow,
      raw: m,
      label: WEEKDAY_LABEL[dow]
    });
    return ' ';
  });

  FESTIVALS.forEach((f) => {
    f.keys.forEach((k) => {
      if (text.indexOf(k) >= 0) {
        addHit(hits, f.md, k);
        text = text.split(k).join(' ');
      }
    });
  });

  text = text.replace(/今天/g, () => {
    const d = new Date();
    const ymd = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    hits.push({ md: ymd.slice(5), ymd, raw: '今天', label: '今天' });
    return ' ';
  });
  text = text.replace(/昨天/g, () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const ymd = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    hits.push({ md: ymd.slice(5), ymd, raw: '昨天', label: '昨天' });
    return ' ';
  });
  text = text.replace(/明天/g, () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const ymd = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    hits.push({ md: ymd.slice(5), ymd, raw: '明天', label: '明天' });
    return ' ';
  });

  text = text.replace(
    /(\d{4})[-/.年]?(\d{1,2})[-/.月](\d{1,2})日?/g,
    (m, y, mo, da) => {
      const md = mdOf(Number(mo), Number(da));
      if (md) {
        hits.push({
          md,
          ymd: `${y}-${md}`,
          raw: m,
          label: `${y}年${labelOf(md)}`
        });
        return ' ';
      }
      return m;
    }
  );

  text = text.replace(/(\d{4})(\d{2})(\d{2})/g, (m, y, mo, da) => {
    const md = mdOf(Number(mo), Number(da));
    if (md) {
      hits.push({
        md,
        ymd: `${y}-${md}`,
        raw: m,
        label: `${y}年${labelOf(md)}`
      });
      return ' ';
    }
    return m;
  });

  text = text.replace(/(\d{1,2})月(\d{1,2})[日号]?/g, (m, mo, da) => {
    const md = mdOf(Number(mo), Number(da));
    if (md) {
      addHit(hits, md, m);
      return ' ';
    }
    return m;
  });

  text = text.replace(
    /([一二三四五六七八九十]+)月([一二三四五六七八九十]+)[日号]?/g,
    (m, mo, da) => {
      const md = mdOf(parseCnNum(mo), parseCnNum(da));
      if (md) {
        addHit(hits, md, m);
        return ' ';
      }
      return m;
    }
  );

  text = text.replace(/\b(\d{1,2})[-/.](\d{1,2})\b/g, (m, mo, da) => {
    const md = mdOf(Number(mo), Number(da));
    if (md) {
      addHit(hits, md, m);
      return ' ';
    }
    return m;
  });

  text = text.replace(/\b(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\b/g, (m, mo, da) => {
    const md = mdOf(Number(mo), Number(da));
    if (md) {
      addHit(hits, md, m);
      return ' ';
    }
    return m;
  });

  text = text.replace(/([一二三四五六七八九十]{1,3})/g, (m) => {
    if (m.length === 2 && CN_DIGIT[m[0]] != null && CN_DIGIT[m[1]] != null) {
      const md = mdOf(CN_DIGIT[m[0]], CN_DIGIT[m[1]]);
      if (md) {
        addHit(hits, md, m);
        return ' ';
      }
    }
    return m;
  });

  return {
    hits,
    rest: text.replace(/\s+/g, ' ').trim()
  };
}

module.exports = {
  parseDateQuery,
  matchDate,
  rowDate,
  ymdOfTs
};
