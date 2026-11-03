// js/cart-groups.js —— 把购物车平铺的 items 按场次分组。
//
// 购物车页和结算页都要用同一套分组逻辑，所以单独放一个文件。

// 输入：cart.items（平铺的座位）
// 输出：[{ session: 场次, items: [座位...], subtotal: 小计 }, ...] 按开场时间排序。
export function groupItemsBySession(items) {
  const groups = [];

  let i;
  let j;
  for (i = 0; i < items.length; i++) {
    const item = items[i];
    let target = null;

    // 在已有的分组里找同一个场次
    for (j = 0; j < groups.length; j++) {
      if (groups[j].session.id === item.session.id) {
        target = groups[j];
        break;
      }
    }

    // 没找到就新建一组。
    if (target === null) {
      target = { session: item.session, items: [], subtotal: 0 };
      groups.push(target);
    }

    target.items.push(item);
    target.subtotal = target.subtotal + item.price;
  }

  // 按开场时间排序（数据量很小，用最普通的比较函数）
  groups.sort(function (a, b) {
    if (a.session.startsAt < b.session.startsAt) {
      return -1;
    }
    if (a.session.startsAt > b.session.startsAt) {
      return 1;
    }
    return 0;
  });

  return groups;
}
