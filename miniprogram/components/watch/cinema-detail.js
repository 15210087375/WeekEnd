const domain = require('../../domain/index');
const routes = require('../../config/routes');

Component({
  properties: {
    cinemaId: { type: String, value: '' }
  },
  data: {
    id: '',
    cinema: null,
    halls: [],
    empty: true
  },
  lifetimes: {
    attached() {
      this.setData({ id: this.data.cinemaId || '' });
      this.reload();
    }
  },
  methods: {
    reload() {
      const cinema = domain.getCinema(this.data.id);
      if (!cinema) {
        wx.showToast({ title: '影院不存在', icon: 'none' });
        return;
      }
      this.setData({
        cinema,
        halls: cinema.halls || [],
        empty: !(cinema.halls && cinema.halls.length)
      });
    },
    goEditCinema() {
      routes.go(routes.cinemaEdit({ id: this.data.id }));
    },
    goHall(e) {
      routes.go(routes.cinemaHall({ id: e.currentTarget.dataset.id, cinemaId: this.data.id }));
    },
    goAddHall() {
      routes.go(routes.cinemaHall({ cinemaId: this.data.id }));
    }
  }
});
