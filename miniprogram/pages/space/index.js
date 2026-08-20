const domain = require('../../domain/index');
const spaceDomain = require('../../domain/space');
const routes = require('../../config/routes');
const { MEMBER_TAG_OPTIONS } = require('../../utils/constants');

Page({
  data: {
    cloudConfigured: false,
    cloudReady: false,
    inSpace: false,
    isOwner: false,
    displayName: '',
    memberNo: 0,
    nameCustomized: false,
    spaceName: '',
    inviteCode: '',
    members: [],
    formInvite: '',
    formDisplayName: '',
    showNameEdit: false,
    busy: false,
    memberTag: 'eater',
    memberTagLabel: '我会吃',
    tagOptions: MEMBER_TAG_OPTIONS
  },

  onShow() {
    this.refreshLocal();
    const silent =
      spaceDomain.ensureSilentLogin || domain.ensureSilentLogin;
    if (typeof silent === 'function') {
      silent.call(spaceDomain).then(() => this.refreshLocal());
    }
  },

  refreshLocal() {
    const status =
      (spaceDomain.cloudStatus && spaceDomain.cloudStatus()) ||
      domain.spaceCloudStatus();
    const session =
      (spaceDomain.getSession && spaceDomain.getSession()) ||
      domain.getSpaceSession();
    const inSpace = session.mode === 'space' && !!session.spaceId;
    const memberTag = session.memberTag || this.data.memberTag || 'eater';
    const members = (session.members || []).map((m) => ({
      ...m,
      memberTagLabel:
        m.memberTagLabel ||
        (m.memberTag === 'cook' ? '我会做' : '我会吃')
    }));
    this.setData({
      cloudConfigured: status.configured,
      cloudReady: status.ready,
      inSpace,
      isOwner: session.role === 'owner',
      displayName: session.displayName || '',
      memberNo: Number(session.memberNo) || 0,
      nameCustomized: !!session.nameCustomized,
      spaceName: session.spaceName || '',
      inviteCode: session.inviteCode || '',
      members,
      formDisplayName: session.nameCustomized
        ? session.displayName || ''
        : this.data.showNameEdit
          ? this.data.formDisplayName
          : '',
      memberTag: inSpace ? memberTag : this.data.memberTag || 'eater',
      memberTagLabel: memberTag === 'cook' ? '我会做' : '我会吃',
      tagOptions: MEMBER_TAG_OPTIONS
    });
  },

  onToggleNameEdit() {
    this.setData({ showNameEdit: !this.data.showNameEdit });
  },

  onNameInput(e) {
    this.setData({ formDisplayName: e.detail.value });
  },

  onInviteInput(e) {
    this.setData({ formInvite: e.detail.value });
  },

  onPickTag(e) {
    const id = e.currentTarget.dataset.id || 'eater';
    this.setData({
      memberTag: id,
      memberTagLabel: id === 'cook' ? '我会做' : '我会吃'
    });
  },

  onSaveName() {
    const name = String(this.data.formDisplayName || '').trim();
    this._run(
      () => spaceDomain.login({ displayName: name, updateName: true }),
      name ? '昵称已更新' : '已恢复默认名'
    );
  },

  onSaveTag() {
    if (!this.data.inSpace) return;
    this._run(
      () => spaceDomain.setMemberTag(this.data.memberTag),
      '标签已更新'
    );
  },

  _run(promiseFactory, okTitle) {
    if (this.data.busy) return;
    this.setData({ busy: true });
    wx.showLoading({ title: '请稍候…', mask: true });
    Promise.resolve()
      .then(promiseFactory)
      .then(() => {
        wx.hideLoading();
        this.setData({ busy: false, showNameEdit: false });
        this.refreshLocal();
        if (okTitle) wx.showToast({ title: okTitle, icon: 'success' });
      })
      .catch((e) => {
        wx.hideLoading();
        this.setData({ busy: false });
        wx.showToast({
          title: (e && e.message) || '操作失败',
          icon: 'none',
          duration: 2800
        });
      });
  },

  onCreateFamily() {
    if (!this.data.cloudConfigured) {
      wx.showToast({ title: '云开发未配置', icon: 'none' });
      return;
    }
    this._run(
      () =>
        spaceDomain.createFamily({
          displayName: this.data.formDisplayName,
          memberTag: this.data.memberTag
        }),
      '已创建'
    );
  },

  onJoin() {
    const code = String(this.data.formInvite || '').trim();
    if (!code) {
      wx.showToast({ title: '请输入邀请码', icon: 'none' });
      return;
    }
    if (!this.data.cloudConfigured) {
      wx.showToast({ title: '云开发未配置', icon: 'none' });
      return;
    }
    this._run(
      () =>
        spaceDomain.joinSpace({
          inviteCode: code,
          displayName: this.data.formDisplayName,
          memberTag: this.data.memberTag
        }),
      '已加入'
    );
  },

  onRefresh() {
    this._run(() => spaceDomain.refreshSpace(), '已刷新');
  },

  onCopyInvite() {
    const code = this.data.inviteCode;
    if (!code) return;
    wx.setClipboardData({
      data: code,
      success: () => wx.showToast({ title: '已复制', icon: 'success' })
    });
  },

  onLeave() {
    wx.showModal({
      title: '退出空间',
      content: '退出后本机保留当前数据，不再写回该空间。是否退出？',
      success: (res) => {
        if (!res.confirm) return;
        this._run(() => spaceDomain.leaveSpace(), '已退出');
      }
    });
  },

  onDissolve() {
    wx.showModal({
      title: '解散空间',
      content: '所有成员将回到仅本机。确定解散？',
      confirmColor: '#fa5151',
      success: (res) => {
        if (!res.confirm) return;
        this._run(() => spaceDomain.dissolveSpace(), '已解散');
      }
    });
  },

  onKick(e) {
    const userId = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name || '该成员';
    wx.showModal({
      title: '移出成员',
      content: `确定将 ${name} 移出？`,
      success: (res) => {
        if (!res.confirm) return;
        this._run(() => spaceDomain.kickMember(userId), '已移出');
      }
    });
  },

  onTransfer(e) {
    const userId = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name || '该成员';
    wx.showModal({
      title: '转让主账号',
      content: `确定将主账号转让给 ${name}？`,
      success: (res) => {
        if (!res.confirm) return;
        this._run(() => spaceDomain.transferOwner(userId), '已转让');
      }
    });
  },

  goBackup() {
    routes.go(routes.backup());
  }
});
