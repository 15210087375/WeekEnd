const dish = require('./dish');
const place = require('./place');
const wish = require('./wish');
const note = require('./note');
const shop = require('./shop');
const schedule = require('./schedule');
const moviePlan = require('./moviePlan');
const movieLog = require('./movieLog');
const cinema = require('./cinema');
const order = require('./order');
const { KIND_LABELS } = require('../utils/constants');
const { parseDateQuery, matchDate, rowDate } = require('../utils/dateQuery');
const { parseScoreQuery, matchScore } = require('../utils/scoreQuery');
const FEATURES = require('../config/searchFeatures');

const GROUP_LIMIT = 5;

function contains(hay, needle) {
  if (!needle) return false;
  return String(hay || '')
    .toLowerCase()
    .indexOf(String(needle).toLowerCase()) >= 0;
}

function ingredientText(d) {
  return (d && d.ingredients ? d.ingredients : []).join(' ');
}

function hit(type, id, title, sub, tag, go, extra) {
  return {
    type,
    id: String(id || ''),
    title: title || '',
    sub: sub || '',
    tag: tag || '',
    go: go || {},
    ...(extra || {})
  };
}

function take(list, expanded) {
  const rows = list || [];
  if (expanded) return { hits: rows, total: rows.length, more: 0 };
  const hits = rows.slice(0, GROUP_LIMIT);
  return {
    hits,
    total: rows.length,
    more: Math.max(0, rows.length - hits.length)
  };
}

function searchFeatures(keyword) {
  const k = String(keyword || '').trim();
  if (!k) {
    return FEATURES.map((f) =>
      hit('feature', f.id, f.title, f.sub, '功能', f.go)
    );
  }
  const kl = k.toLowerCase();
  return FEATURES.filter((f) => {
    if (String(f.title).toLowerCase().indexOf(kl) >= 0) return true;
    return (f.keywords || []).some((w) => w.toLowerCase().indexOf(kl) >= 0 || kl.indexOf(w.toLowerCase()) >= 0);
  }).map((f) => hit('feature', f.id, f.title, f.sub, '功能', f.go));
}

function searchDishes(keyword, _dates, scoreHits) {
  const k = String(keyword || '').trim();
  const hasScore = scoreHits && scoreHits.length;
  if (!k && !hasScore) return [];
  return dish
    .list()
    .filter((d) => {
      if (hasScore && !matchScore(d.score, scoreHits)) return false;
      if (k) {
        if (contains(d.name, k)) return true;
        if (contains(ingredientText(d), k)) return true;
        return false;
      }
      return true;
    })
    .map((d) => {
      const inIng = k && !contains(d.name, k) && contains(ingredientText(d), k);
      const line = (d.ingredients || []).find((x) => contains(x, k));
      const scoreText = d.score != null ? `评分 ${d.score}` : '';
      const sub = inIng ? `配料：${line}` : scoreText || KIND_LABELS[d.kind] || '';
      return hit(
        'dish',
        d.id,
        d.name,
        sub,
        d.kind === 'homemade' ? '菜谱' : '档案',
        { kind: 'dishDetail', id: d.id }
      );
    });
}

function searchPlaces(keyword) {
  if (!keyword) return [];
  return place
    .list({ keyword, isVirtual: false })
    .map((p) =>
      hit(
        'place',
        p.id,
        place.label(p) || p.brandName,
        p.address || '',
        '餐厅',
        { kind: 'placeDetail', id: p.id }
      )
    );
}

function searchWishes(keyword, dateHits) {
  return wish
    .list()
    .filter((w) => {
      if (dateHits && dateHits.length && !matchDate(rowDate(w, ['createdAt']), dateHits)) {
        return false;
      }
      if (keyword && !contains(w.title, keyword)) return false;
      if (!keyword && dateHits && dateHits.length) return true;
      return !!keyword;
    })
    .map((w) =>
      hit('wish', w.id, w.title, w.statusLabel || '', '心愿', {
        kind: 'wishEdit',
        id: w.id
      })
    );
}

function searchNotes(keyword, dateHits) {
  return note
    .list()
    .filter((n) => {
      if (dateHits && dateHits.length && !matchDate(rowDate(n, ['date']), dateHits)) {
        return false;
      }
      if (keyword) {
        const ok = contains(n.title, keyword) || contains(n.body, keyword);
        if (!ok) return false;
      } else if (!dateHits || !dateHits.length) {
        return false;
      }
      return true;
    })
    .map((n) =>
      hit(
        'note',
        n.id,
        n.displayTitle || n.title || '随笔',
        n.date || '',
        '随笔',
        { kind: 'noteEdit', id: n.id }
      )
    );
}

function searchShops(keyword, dateHits) {
  return shop
    .list()
    .filter((s) => {
      if (dateHits && dateHits.length && !matchDate(rowDate(s, ['date']), dateHits)) {
        return false;
      }
      if (keyword && !contains(s.displayTitle || s.storeName, keyword)) return false;
      if (!keyword && dateHits && dateHits.length) return true;
      return !!keyword;
    })
    .map((s) =>
      hit('shop', s.id, s.displayTitle || s.storeName, s.date || '', '购物', {
        kind: 'shopEdit',
        id: s.id
      })
    );
}

function searchSchedules(keyword, dateHits) {
  return schedule
    .list()
    .filter((s) => {
      if (dateHits && dateHits.length && !matchDate(rowDate(s, ['date']), dateHits)) {
        return false;
      }
      if (keyword && !contains(s.title, keyword)) return false;
      if (!keyword && dateHits && dateHits.length) return true;
      return !!keyword;
    })
    .map((s) =>
      hit('schedule', s.id, s.title, s.date || '', '日程', {
        kind: 'scheduleEdit',
        id: s.id,
        date: s.date
      })
    );
}

function searchMovies(keyword, dateHits) {
  const plans = moviePlan
    .list()
    .filter((p) => {
      if (dateHits && dateHits.length && !matchDate(rowDate(p, ['date']), dateHits)) {
        return false;
      }
      if (keyword && !contains(p.title, keyword)) return false;
      if (!keyword && dateHits && dateHits.length) return true;
      return !!keyword;
    })
    .map((p) =>
      hit('movie', p.id, p.title, p.date || p.placeText || '', '观影计划', {
        kind: 'moviePlanEdit',
        id: p.id
      })
    );
  const logs = movieLog
    .list()
    .filter((p) => {
      if (dateHits && dateHits.length && !matchDate(rowDate(p, ['date']), dateHits)) {
        return false;
      }
      if (keyword && !contains(p.title, keyword)) return false;
      if (!keyword && dateHits && dateHits.length) return true;
      return !!keyword;
    })
    .map((p) =>
      hit('movie', `log-${p.id}`, p.title, p.date || '', '观影记录', {
        kind: 'movieLogEdit',
        id: p.id
      })
    );
  const cinemas = keyword
    ? cinema.listCinemas().filter((c) => contains(c.name, keyword)).map((c) =>
        hit('movie', `cin-${c.id}`, c.name, '', '影院', {
          kind: 'cinemaDetail',
          id: c.id
        })
      )
    : [];
  return plans.concat(logs, cinemas);
}

function searchOrders(keyword, dateHits) {
  return order
    .list()
    .filter((o) => {
      if (dateHits && dateHits.length && !matchDate(rowDate(o, ['mealDate']), dateHits)) {
        return false;
      }
      const title = o.title || '点餐';
      if (keyword && !contains(title, keyword)) return false;
      if (!keyword && dateHits && dateHits.length) return true;
      return !!keyword;
    })
    .map((o) =>
      hit('order', o.id, o.title || '点餐', o.scheduleText || o.mealDate || '', '点餐', {
        kind: 'orderDetail',
        id: o.id
      })
    );
}

/**
 * 登记搜索源。新功能加一组即可。
 */
const SOURCES = [
  { id: 'dish', title: '美食', run: (k, d, s) => searchDishes(k, d, s) },
  { id: 'place', title: '餐厅', run: (k) => searchPlaces(k) },
  { id: 'schedule', title: '日程', run: (k, d) => searchSchedules(k, d) },
  { id: 'wish', title: '心愿', run: (k, d) => searchWishes(k, d) },
  { id: 'note', title: '随笔', run: (k, d) => searchNotes(k, d) },
  { id: 'shop', title: '购物', run: (k, d) => searchShops(k, d) },
  { id: 'movie', title: '观影', run: (k, d) => searchMovies(k, d) },
  { id: 'order', title: '点餐', run: (k, d) => searchOrders(k, d) }
];

function searchAll(raw, options) {
  const expanded = (options && options.expanded) || {};
  const parsed = parseDateQuery(raw);
  const scored = parseScoreQuery(parsed.rest);
  const keyword = scored.rest;
  const dateHits = parsed.hits;
  const scoreHits = scored.hits;
  const q = String(raw || '').trim();

  const groups = [];
  const features = searchFeatures(q);
  if (features.length) {
    const pack = take(features, !!expanded.feature);
    groups.push({
      id: 'feature',
      title: '功能',
      ...pack
    });
  }

  if (dateHits.length) {
    const dated = [];
    SOURCES.forEach((src) => {
      if (src.id === 'dish' || src.id === 'place') return;
      dated.push.apply(dated, src.run('', dateHits, scoreHits) || []);
    });
    if (dated.length) {
      const pack = take(dated, !!expanded.date);
      groups.push({
        id: 'date',
        title: dateHits.length === 1 ? dateHits[0].label : '日期',
        ...pack
      });
    }
  }

  if (keyword || scoreHits.length) {
    SOURCES.forEach((src) => {
      if (!keyword && src.id !== 'dish') return;
      const rows = src.run(keyword, null, scoreHits) || [];
      if (!rows.length) return;
      const pack = take(rows, !!expanded[src.id]);
      groups.push({
        id: src.id,
        title: src.title,
        ...pack
      });
    });
  }

  return {
    keyword,
    dates: dateHits,
    scores: scoreHits,
    groups,
    empty: !groups.length
  };
}

function listFeatures() {
  return searchFeatures('');
}

module.exports = {
  searchAll,
  listFeatures,
  GROUP_LIMIT,
  SOURCES,
  FEATURES
};
