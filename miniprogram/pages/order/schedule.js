const domain = require('../../domain/index');
const routes = require('../../config/routes');
const { MEAL_SLOT_OPTIONS } = require('../../utils/constants');

Page({
  data: {
    mode: 'create',
    orderId: '',
    mealDate: '',
    mealSlot: 'lunch',
    slots: MEAL_SLOT_OPTIONS,
    saving: false
  },

  onLoad(query) {
    const mode = query.mode === 'edit' || query.id ? 'edit' : 'create';
    const orderId = query.id || '';
    let mealDate = domain.orderToday();
    let mealSlot = 'lunch';

    if (orderId) {
      const o = domain.getOrder(orderId);
      if (o) {
        mealDate = o.mealDate || mealDate;
        mealSlot = o.mealSlot || mealSlot;
      }
    }

    this.setData({
      mode,
      orderId,
      mealDate,
      mealSlot,
      slots: MEAL_SLOT_OPTIONS
    });
    wx.setNavigationBarTitle({
      title: mode === 'edit' ? '修改就餐时间' : '选择就餐时间'
    });
  },

  onDateChange(e) {
    this.setData({ mealDate: e.detail.value });
  },

  onPickSlot(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    this.setData({ mealSlot: id });
  },

  onSave() {
    if (this.data.saving) return;
    const { mealDate, mealSlot, mode, orderId } = this.data;
    if (!mealDate) {
      wx.showToast({ title: '请选择日期', icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    try {
      if (mode === 'edit' && orderId) {
        domain.setOrderSchedule(orderId, mealDate, mealSlot);
        // 若是当前购物车订单，保持 active
        try {
          const snap = domain.cartSnapshot();
          if (snap.orderId === orderId) {
            domain.cartSetSchedule(mealDate, mealSlot);
          }
        } catch (e) {
          // ignore
        }
        wx.showToast({ title: '已保存', icon: 'success' });
        setTimeout(() => routes.back(), 400);
      } else {
        // 新建预点餐
        const o = domain.cartCreatePreorder
          ? domain.cartCreatePreorder(mealDate, mealSlot)
          : domain.createOrder({
              title: '预点餐',
              status: 'preorder',
              mealDate,
              mealSlot,
              items: [],
              allowEmpty: true
            });
        if (o && o.id && domain.cartSwitchOrder) {
          try {
            domain.cartSwitchOrder(o.id);
          } catch (e2) {
            // ignore
          }
        }
        // createPreorder already sets active
        wx.showToast({ title: '已创建', icon: 'success' });
        setTimeout(() => {
          routes.back(routes.PATH.home);
        }, 400);
      }
    } catch (e) {
      wx.showToast({ title: (e && e.message) || '保存失败', icon: 'none' });
    }
    this.setData({ saving: false });
  }
});
