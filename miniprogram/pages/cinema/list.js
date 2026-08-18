const routes = require('../../config/routes');

Page({
  onLoad() {
    routes.redirect(routes.watch({ tab: 'cinema' }));
  }
});
