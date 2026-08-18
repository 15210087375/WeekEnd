const domain = require('../../domain/index');
const routes = require('../../config/routes');
const fabReveal = require('../../behaviors/fabReveal');
const { formatDateWeekday } = require('../../utils/format');
const { NOTE_TAGS } = require('../../utils/constants');

const FILTER_ALL = 'all';
const FILTERS = [
  { id: FILTER_ALL, label: '全部' },
  { id: 'month:this', label: '本月' },
  { id: 'vis:private', label: '仅自己' },
  { id: 'vis:space', label: '家人' }
].concat(NOTE_TAGS.map((t) => ({ id: `tag:${t.id}`, label: t.name })));

function parseFilter(id) {
  const raw = String(id || FILTER_ALL);
  if (raw === 'month:this') return { month: 'this' };
  if (raw === 'vis:private') return { visibility: 'private' };
  if (raw === 'vis:space') return { visibility: 'space' };
  if (raw.indexOf('tag:') === 0) return { tag: raw.slice(4) };
  return {};
}

Page({
  behaviors: [fabReveal],
  data: {
    filters: FILTERS,
    tags: NOTE_TAGS,
    filterId: FILTER_ALL,
    list: [],
    empty: true,
    expandedId: ''
  },

  onShow() {
    this.reload();
  },

  reload() {
    const filter = parseFilter(this.data.filterId);
    let list = domain.listNotes(filter).map((row) => ({
      ...row,
      dateText: formatDateWeekday(row.date),
      imageUrls: (row.images || []).map((img) => img.localPath).filter(Boolean),
      isPrivate: row.visibility !== 'space'
    }));
    if (filter.visibility) {
      list = list.filter((r) =>
        filter.visibility === 'private' ? r.visibility !== 'space' : r.visibility === 'space'
      );
    }
    const expandedId = this.data.expandedId;
    const still = expandedId && list.some((w) => w.id === expandedId);
    this.setData({
      list,
      empty: !list.length,
      expandedId: still ? expandedId : ''
    });
  },

  onFilter(e) {
    const id = e.currentTarget.dataset.id || FILTER_ALL;
    this.setData({ filterId: String(id), expandedId: '' }, () => this.reload());
  },

  onToggle(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({
      expandedId: this.data.expandedId === id ? '' : id
    });
  },

  patchNote(id, extra) {
    const row = domain.getNote(id);
    if (!row) return;
    domain.saveNote({
      id: row.id,
      title: row.title,
      body: row.body,
      date: row.date,
      tag: row.tag,
      images: row.images,
      visibility: row.visibility,
      ...extra
    });
    this.reload();
  },

  onPickTag(e) {
    const id = e.currentTarget.dataset.id;
    const tag = e.currentTarget.dataset.tag || '';
    if (!id) return;
    const row = domain.getNote(id);
    if (!row) return;
    const next = row.tag === tag ? '' : tag;
    try {
      this.patchNote(id, { tag: next });
    } catch (err) {
      wx.showToast({ title: (err && err.message) || '更新失败', icon: 'none' });
    }
  },

  onPickVis(e) {
    const id = e.currentTarget.dataset.id;
    const vis = e.currentTarget.dataset.vis;
    if (!id || (vis !== 'private' && vis !== 'space')) return;
    try {
      this.patchNote(id, { visibility: vis });
    } catch (err) {
      wx.showToast({ title: (err && err.message) || '更新失败', icon: 'none' });
    }
  },

  goEdit(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    routes.go(routes.noteEdit({ id }));
  },

  onPreview(e) {
    const urls = e.currentTarget.dataset.urls || [];
    const current = e.currentTarget.dataset.current || urls[0];
    if (!urls.length) return;
    wx.previewImage({ current, urls });
  },

  goCreate() {
    routes.go(routes.noteEdit());
  }
});
