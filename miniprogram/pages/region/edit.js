const domain = require('../../domain/index');
const routes = require('../../config/routes');

Page({
  data: {
    list: [],
    name: '',
    editId: '',
    /** 展开的区域 id 集合（页面侧用 map 还原） */
    _expanded: {}
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const expanded = this._expanded || {};
    const list = domain.listRegions().map((r) => {
      const kids = domain.getRegionChildren(r.id);
      return {
        id: r.id,
        name: r.name,
        mallCount: kids.mallCount,
        placeCount: kids.placeCount,
        canDelete: kids.canDelete,
        malls: kids.malls,
        places: kids.places,
        expanded: !!expanded[r.id]
      };
    });
    this.setData({ list });
  },

  onName(e) {
    this.setData({ name: e.detail.value });
  },

  onEdit(e) {
    this.setData({
      editId: e.currentTarget.dataset.id,
      name: e.currentTarget.dataset.name
    });
  },

  onCancelEdit() {
    this.setData({ editId: '', name: '' });
  },

  toggleExpand(e) {
    const id = e.currentTarget.dataset.id;
    if (!this._expanded) this._expanded = {};
    this._expanded[id] = !this._expanded[id];
    this.refresh();
  },

  goPlace(e) {
    const id = e.currentTarget.dataset.id;
    if (id) routes.go(routes.placeDetail(id));
  },

  onSave() {
    try {
      domain.saveRegion({
        id: this.data.editId || undefined,
        name: this.data.name
      });
      this.setData({ editId: '', name: '' });
      this.refresh();
      wx.showToast({ title: '已保存', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: e.message || '失败', icon: 'none' });
    }
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name || '该区域';
    const kids = domain.getRegionChildren(id);

    if (kids.canDelete) {
      wx.showModal({
        title: '删除区域',
        content: `确定删除「${name}」？此操作不可恢复。`,
        success: (res) => {
          if (!res.confirm) return;
          this.doDelete(id);
        }
      });
      return;
    }

    // 有子项：展开并展示明细，不真正删除
    if (!this._expanded) this._expanded = {};
    this._expanded[id] = true;
    this.refresh();

    const mallNames = kids.malls
      .slice(0, 5)
      .map((m) => m.name)
      .join('、');
    const placeNames = kids.places
      .slice(0, 5)
      .map((p) => (p.storeName ? `${p.brandName}（${p.storeName}）` : p.brandName))
      .join('、');
    const lines = [`「${name}」下仍有子项，无法直接删除：`];
    if (kids.mallCount) {
      lines.push(
        `商场 ${kids.mallCount} 个` +
          (mallNames ? `：${mallNames}${kids.mallCount > 5 ? '…' : ''}` : '')
      );
    }
    if (kids.placeCount) {
      lines.push(
        `门店 ${kids.placeCount} 个` +
          (placeNames ? `：${placeNames}${kids.placeCount > 5 ? '…' : ''}` : '')
      );
    }
    lines.push('请先处理下方展开的子项，或到「浏览」中管理。');

    wx.showModal({
      title: '无法删除',
      content: lines.join('\n'),
      showCancel: false,
      confirmText: '知道了'
    });
  },

  doDelete(id) {
    try {
      domain.deleteRegion(id);
      if (this.data.editId === id) this.setData({ editId: '', name: '' });
      if (this._expanded) delete this._expanded[id];
      this.refresh();
      wx.showToast({ title: '已删除', icon: 'success' });
    } catch (err) {
      // 兜底：再展开子项
      if (!this._expanded) this._expanded = {};
      this._expanded[id] = true;
      this.refresh();
      wx.showModal({
        title: '无法删除',
        content: err.message || '删除失败',
        showCancel: false
      });
    }
  }
});
