// group cart items by session, sorted by start time
export function groupItemsBySession(items) {
  const groups = [];

  let i;
  let j;
  for (i = 0; i < items.length; i++) {
    const item = items[i];
    let target = null;

    for (j = 0; j < groups.length; j++) {
      if (groups[j].session.id === item.session.id) {
        target = groups[j];
        break;
      }
    }

    if (target === null) {
      target = { session: item.session, items: [], subtotal: 0 };
      groups.push(target);
    }

    target.items.push(item);
    target.subtotal = target.subtotal + item.price;
  }

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
