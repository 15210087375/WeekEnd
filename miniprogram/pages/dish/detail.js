const domain = require('../../domain/index');
const routes = require('../../config/routes');
const { getModule, isRecipe } = require('../../config/modules');
const { SPICY_LABELS } = require('../../utils/constants');
const { categoryLabel } = require('../../config/categories');
const {
  BTN_LABEL,
  copyDouyinShareText,
  hasShareText
} = require('../../utils/douyinShare');

Page({
  data: {
    id: '',
    dish: null,
    kindLabel: '',
    spicyLabel: '',
    categoryLabel: '',
    isRecipe: false,
    theme: 'out',
    hasDouyinShare: false,
    douyinBtnLabel: BTN_LABEL
  },

  onLoad(query) {
    this.setData({ id: query.id || '' });
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const dish = domain.enrichDish(domain.getDish(this.data.id));
    if (!dish) {
      wx.showToast({ title: '记录不存在', icon: 'none' });
      return;
    }
    const mod = getModule(dish.kind);
    const recipe = isRecipe(dish.kind);
    const hasDouyinShare = hasShareText(dish.videoUrl);
    this.setData({
      dish,
      isRecipe: recipe,
      kindLabel: mod.name,
      theme: mod.theme,
      categoryLabel: categoryLabel(dish.category),
      spicyLabel: dish.spicy == null ? '' : SPICY_LABELS[dish.spicy] || '',
      hasDouyinShare,
      douyinBtnLabel: BTN_LABEL
    });
    wx.setNavigationBarTitle({
      title: dish.name || (recipe ? '菜谱详情' : '档案详情')
    });
  },

  preview(e) {
    const url = e.currentTarget.dataset.url;
    const urls = (this.data.dish.images || []).map((i) => i.localPath);
    wx.previewImage({ current: url, urls });
  },

  /** 复制抖音完整分享口令并引导打开抖音（不唤起 App） */
  copyDouyin() {
    copyDouyinShareText(this.data.dish && this.data.dish.videoUrl);
  },

  onEdit() {
    const kind = this.data.dish ? this.data.dish.kind : '';
    routes.go(routes.dishEdit({ id: this.data.id, kind }));
  },

  onDelete() {
    const recipe = this.data.isRecipe;
    wx.showModal({
      title: recipe ? '删除菜谱' : '删除美食档案',
      content: recipe
        ? '确定删除该菜谱及其本地图片？'
        : '确定删除该档案及其本地图片？',
      success: (res) => {
        if (!res.confirm) return;
        try {
          domain.deleteDish(this.data.id);
          wx.showToast({ title: '已删除', icon: 'success' });
          setTimeout(() => routes.back(), 400);
        } catch (e) {
          wx.showToast({ title: e.message || '删除失败', icon: 'none' });
        }
      }
    });
  }
});
