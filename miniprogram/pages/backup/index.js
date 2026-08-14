const domain = require('../../domain/index');
const backupFile = require('../../services/backupFile');
const { BACKUP_MODULE_META } = require('../../utils/constants');

Page({
  data: {
    moduleOptions: BACKUP_MODULE_META.map((m) => ({
      ...m,
      checked: true
    })),
    selectAll: true,
    exporting: false,
    importing: false,
    lastExportName: '',
    lastExportSize: '',
    lastExportModules: ''
  },

  onToggleModule(e) {
    const id = e.currentTarget.dataset.id;
    const moduleOptions = this.data.moduleOptions.map((m) => {
      if (m.id !== id) return m;
      return { ...m, checked: !m.checked };
    });
    const selectAll = moduleOptions.every((m) => m.checked);
    this.setData({ moduleOptions, selectAll });
  },

  onToggleAll() {
    const next = !this.data.selectAll;
    const moduleOptions = this.data.moduleOptions.map((m) => ({
      ...m,
      checked: next
    }));
    this.setData({ moduleOptions, selectAll: next });
  },

  _selectedModules() {
    const list = this.data.moduleOptions.filter((m) => m.checked).map((m) => m.id);
    if (!list.length) {
      throw new Error('请至少选择一个模块');
    }
    return list;
  },

  onExportFile() {
    this._exportThen((filePath, fileName, sizeLabel) => {
      backupFile
        .shareBackupFile(filePath, fileName)
        .then(() => {
          wx.showToast({ title: '请选择发送对象', icon: 'none' });
        })
        .catch((err) => {
          const msg = (err && err.errMsg) || (err && err.message) || '';
          if (msg.indexOf('cancel') >= 0) return;
          backupFile
            .openBackupFile(filePath)
            .then(() => {
              wx.showModal({
                title: '已生成备份',
                content: `文件 ${fileName}（${sizeLabel}）。若无法分享，可用「打开文件」后通过系统菜单转发。`,
                showCancel: false
              });
            })
            .catch(() => {
              wx.showModal({
                title: '文件已生成',
                content: `${fileName}\n大小 ${sizeLabel}\n请用「导出并打开文件」或升级微信后分享。`,
                showCancel: false
              });
            });
        });
    });
  },

  onExportOpen() {
    this._exportThen((filePath, fileName, sizeLabel) => {
      backupFile
        .openBackupFile(filePath)
        .then(() => {
          wx.showToast({ title: '已打开', icon: 'success' });
        })
        .catch(() => {
          wx.showModal({
            title: '导出成功',
            content: `已写入 ${fileName}（${sizeLabel}）。当前环境无法预览，请改用「导出并分享文件」。`,
            showCancel: false
          });
        });
    });
  },

  _exportThen(done) {
    if (this.data.exporting) return;
    let modules;
    try {
      modules = this._selectedModules();
    } catch (e) {
      wx.showToast({ title: e.message || '请选择模块', icon: 'none' });
      return;
    }
    this.setData({ exporting: true });
    wx.showLoading({ title: '正在打包…', mask: true });
    setTimeout(() => {
      try {
        const pkg = domain.exportPackage(modules);
        const { filePath, fileName, size } = backupFile.writeBackupFile(pkg);
        const sizeLabel = backupFile.formatSize(size);
        const lastExportModules = domain.backupModulesLabel(modules);
        this.setData({
          lastExportName: fileName,
          lastExportSize: sizeLabel,
          lastExportModules
        });
        wx.hideLoading();
        this.setData({ exporting: false });
        done(filePath, fileName, sizeLabel);
      } catch (e) {
        wx.hideLoading();
        this.setData({ exporting: false });
        wx.showToast({
          title: (e && e.message) || '导出失败',
          icon: 'none'
        });
      }
    }, 50);
  },

  onImportFile() {
    if (this.data.importing) return;
    wx.showModal({
      title: '导入备份文件',
      content:
        '将按备份包内的模块替换本地对应数据（包内未含的模块保持不动）。不可撤销，建议先导出当前数据。是否继续选择文件？',
      success: (res) => {
        if (!res.confirm) return;
        this.setData({ importing: true });
        backupFile
          .chooseAndReadBackup()
          .then(({ pkg, fileName, size }) => {
            const label = domain.backupModulesLabel(
              (pkg && pkg.modules) || ['all']
            );
            wx.showModal({
              title: '确认导入',
              content: `将替换：${label}\n来自 ${fileName || '备份'}（${backupFile.formatSize(size)}）`,
              success: (r2) => {
                if (!r2.confirm) {
                  this.setData({ importing: false });
                  return;
                }
                wx.showLoading({ title: '正在导入…', mask: true });
                try {
                  const result = domain.importPackage(pkg);
                  wx.hideLoading();
                  this.setData({ importing: false });
                  wx.showModal({
                    title: '导入成功',
                    content: `已恢复模块：${result.modulesLabel}`,
                    showCancel: false
                  });
                } catch (e) {
                  wx.hideLoading();
                  this.setData({ importing: false });
                  wx.showToast({
                    title: (e && e.message) || '导入失败',
                    icon: 'none'
                  });
                }
              }
            });
          })
          .catch((err) => {
            this.setData({ importing: false });
            if (err && err.message === 'cancel') return;
            wx.showToast({
              title: (err && err.message) || '选择文件失败',
              icon: 'none'
            });
          });
      }
    });
  },

  onExportClip() {
    try {
      const modules = this._selectedModules();
      const pkg = domain.exportPackage(modules);
      const text = JSON.stringify(pkg);
      const kb = Math.round(text.length / 1024);
      if (kb > 800) {
        wx.showModal({
          title: '数据较大',
          content: `约 ${kb} KB，剪贴板可能失败或截断。建议改用文件导出。仍要复制？`,
          success: (res) => {
            if (res.confirm) this._copyClip(text, kb);
          }
        });
        return;
      }
      this._copyClip(text, kb);
    } catch (e) {
      wx.showToast({ title: (e && e.message) || '导出失败', icon: 'none' });
    }
  },

  _copyClip(text, kb) {
    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showModal({
          title: '已复制到剪贴板',
          content: `约 ${kb} KB。大备份请改用文件分享。`,
          showCancel: false
        });
      }
    });
  },

  onImportClip() {
    wx.showModal({
      title: '从剪贴板导入',
      content: '将按备份包内模块替换本地对应数据。请确认剪贴板是完整备份 JSON。',
      success: (res) => {
        if (!res.confirm) return;
        wx.getClipboardData({
          success: (clip) => {
            try {
              const pkg = JSON.parse(clip.data);
              const result = domain.importPackage(pkg);
              wx.showModal({
                title: '导入成功',
                content: `已恢复模块：${result.modulesLabel}`,
                showCancel: false
              });
            } catch (e) {
              wx.showToast({
                title: (e && e.message) || '导入失败',
                icon: 'none'
              });
            }
          },
          fail: () => wx.showToast({ title: '读取剪贴板失败', icon: 'none' })
        });
      }
    });
  }
});
