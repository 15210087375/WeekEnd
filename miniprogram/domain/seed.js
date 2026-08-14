/**
 * 种子数据：默认区域 / 默认挂载点
 * 保证「首次录入」零前置步骤。
 */
const region = require('./region');
const place = require('./place');
const cache = require('./cache');
const { DISH_KIND, VIRTUAL_HOME_BRAND, DEFAULT_REGION_NAME } = require('../utils/constants');
const { getModule } = require('../config/modules');

function ensureDefaultRegion() {
  cache.ensure();
  let r = cache.get().regions.find((x) => x.name === DEFAULT_REGION_NAME);
  if (!r) {
    r = region.save({ name: DEFAULT_REGION_NAME, sort: 999 });
  }
  return region.get(r.id);
}

function ensureHomemadePlace() {
  const r = ensureDefaultRegion();
  let p = cache.ensure().places.find(
    (x) => x.isVirtual && x.brandName === VIRTUAL_HOME_BRAND
  );
  if (!p) {
    p = place.save({
      regionId: r.id,
      mallId: null,
      brandName: VIRTUAL_HOME_BRAND,
      isVirtual: true,
      note: '系统种子：自做菜谱默认挂载点'
    });
  }
  return { region: region.get(r.id), place: place.get(p.id) };
}

function ensureDefaultPlace(kind) {
  if (kind === DISH_KIND.HOMEMADE) {
    return ensureHomemadePlace();
  }
  const mod = getModule(DISH_KIND.DINE_OUT);
  const r = ensureDefaultRegion();
  let p = cache.ensure().places.find(
    (x) => !x.isVirtual && x.brandName === mod.defaultPlaceBrand
  );
  if (!p) {
    p = place.save({
      regionId: r.id,
      mallId: null,
      brandName: mod.defaultPlaceBrand,
      isVirtual: false,
      note: '系统种子：外出美食默认挂载，可稍后改门店'
    });
  }
  return { region: region.get(r.id), place: place.get(p.id) };
}

module.exports = {
  ensureDefaultRegion,
  ensureHomemadePlace,
  ensureDefaultPlace
};
