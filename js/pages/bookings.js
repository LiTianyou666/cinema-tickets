// js/pages/bookings.js —— 订单列表页（规格书第 14 章）
//
// 参考标记：S09a（各种状态）、S09b（刚下完单）、S09c（取消确认）、S09d（没有订单）
//
// 【笨办法】取消成功后重新拉一遍订单列表，不改本地状态

import { request } from '../api.js';
import { getConfig } from '../config.js';
import {
  setTimeZone, formatSessionDateTime, formatFormat, formatTickets,
  formatMoney, formatTime, formatBookingStatus, getStatusClass
} from '../format.js';
import { requireAuth, initHeader, updateCartCounter } from '../auth.js';
import { showAlert, clearAlerts, showApiError, showToast } from '../ui.js';

let config = null;
let cart = null;
let pendingBooking = null; // 对话框里等待确认的那一条订单

// 受限页面 5.2.1
if (requireAuth()) {
  start();
}

async function start() {
  config = await getConfig();
  setTimeZone(config.timeZone);
  initHeader();

  setupDialog();

  await loadCart();
  await loadBookings();

  showCreatedAlert();
  showCartHint();
}


// ---------------------------------------------------------------------------
// 数据
// ---------------------------------------------------------------------------

async function loadCart() {
  try {
    cart = await request('/cart');
  } catch (error) {
    cart = null;
  }
}


async function loadBookings() {
  const list = document.querySelector('#bookings-list');
  const emptyBox = document.querySelector('#bookings-empty');

  let bookings;

  try {
    bookings = await request('/bookings');
  } catch (error) {
    showApiError(error, null);
    return;
  }

  list.textContent = '';
  emptyBox.textContent = '';

  // 一条都没有 14.6
  if (bookings.length === 0) {
    emptyBox.appendChild(createEmptyState());
    return;
  }

  let i;
  for (i = 0; i < bookings.length; i++) {
    list.appendChild(createBookingRow(bookings[i]));
  }
}


// ---------------------------------------------------------------------------
// 一行订单
// ---------------------------------------------------------------------------

function createBookingRow(booking) {
  const item = document.createElement('article');
  item.className = 'c-booking-item';
  item.innerHTML =
    '<div class="c-poster c-poster--xs"><img class="c-poster__img" alt="" width="400" height="600"></div>' +
    '<div class="c-booking-item__main">' +
      '<h3 class="c-booking-item__title"><a></a></h3>' +
      '<p class="c-booking-item__meta"><span class="js-date"></span><span class="c-format"></span><span class="js-hall"></span></p>' +
    '</div>' +
    '<a class="c-booking-item__code"></a>' +
    '<span class="c-booking-item__tickets"></span>' +
    '<span class="c-booking-item__total"></span>' +
    '<span class="c-status"></span>' +
    '<div class="c-booking-item__actions"></div>';

  const detailUrl = 'booking.html?id=' + booking.id;

  item.querySelector('.c-poster__img').src = booking.movie.posterUrl;

  const titleLink = item.querySelector('.c-booking-item__title a');
  titleLink.textContent = booking.movie.title;
  titleLink.href = detailUrl;

  item.querySelector('.js-date').textContent = formatSessionDateTime(booking.session.startsAt);
  item.querySelector('.c-format').textContent = formatFormat(booking.session.format);
  item.querySelector('.js-hall').textContent = booking.session.hallName;

  const codeLink = item.querySelector('.c-booking-item__code');
  codeLink.textContent = booking.code;
  codeLink.href = detailUrl;

  item.querySelector('.c-booking-item__tickets').textContent = formatTickets(booking.ticketsCount);
  item.querySelector('.c-booking-item__total').textContent = formatMoney(booking.total);

  const statusSpan = item.querySelector('.c-status');
  statusSpan.className = 'c-status ' + getStatusClass(booking.status);
  statusSpan.textContent = formatBookingStatus(booking.status);

  fillActions(item.querySelector('.c-booking-item__actions'), booking);

  return item;
}


// 操作区按状态和取消截止时间决定 14.2
function fillActions(actionsBox, booking) {
  // 已完成 → 去写影评
  if (booking.status === 'Completed') {
    actionsBox.innerHTML =
      '<a class="c-btn c-btn--link" href="movie.html?id=' + booking.movie.id + '">Review the movie</a>';
    return;
  }

  // 已取消 → 什么都不放
  if (booking.status === 'Cancelled') {
    return;
  }

  // Active：看还来不来得及取消
  const startsAt = new Date(booking.session.startsAt).getTime();
  const cancelDeadline = startsAt - config.cancellationCutoffMinutes * 60 * 1000;

  if (cancelDeadline > Date.now()) {
    const button = document.createElement('button');
    button.className = 'c-btn c-btn--secondary c-btn--danger c-btn--sm';
    button.type = 'button';
    button.textContent = 'Cancel booking';
    button.addEventListener('click', function () {
      openCancelDialog(booking);
    });
    actionsBox.appendChild(button);
    return;
  }

  // 来不及了 → 显示截止时间
  const span = document.createElement('span');
  span.textContent = 'Cancellation closed at ' + formatTime(new Date(cancelDeadline).toISOString());
  actionsBox.appendChild(span);
}


// ---------------------------------------------------------------------------
// 取消订单
// ---------------------------------------------------------------------------

function setupDialog() {
  const dialog = document.querySelector('#cancel-dialog');

  dialog.querySelector('#keep-booking').addEventListener('click', function () {
    dialog.close();
  });

  dialog.querySelector('#confirm-cancel').addEventListener('click', async function () {
    if (pendingBooking === null) {
      return;
    }

    const booking = pendingBooking;
    pendingBooking = null;
    dialog.close();

    try {
      await request('/bookings/' + booking.id + '/cancel', { method: 'POST' });
      showToast('The booking ' + booking.code + ' is cancelled.', 'success');
      await loadBookings();
      await updateCartCounter();
    } catch (error) {
      showToast(error.detail, 'danger');
      await loadBookings();
    }
  });
}


function openCancelDialog(booking) {
  pendingBooking = booking;

  const dialog = document.querySelector('#cancel-dialog');
  dialog.querySelector('#cancel-dialog-title').textContent = 'Cancel booking ' + booking.code + '?';
  dialog.showModal();
}


// ---------------------------------------------------------------------------
// 顶部两块提示
// ---------------------------------------------------------------------------

// ?created=N → N bookings are created. The cart is empty.（规格书 14.5）
function showCreatedAlert() {
  const params = new URLSearchParams(location.search);
  const created = params.get('created');

  if (created === null) {
    return;
  }

  let text;

  if (created === '1') {
    text = '1 booking is created. The cart is empty.';
  } else {
    text = created + ' bookings are created. The cart is empty.';
  }

  showAlert(document.querySelector('#created-alert'), text, 'success');
}


// 购物车不为空 → 提示卡（规格书 14.4）
function showCartHint() {
  const box = document.querySelector('#cart-hint');

  if (cart === null || cart.items.length === 0) {
    box.hidden = true;
    return;
  }

  box.hidden = false;
  box.innerHTML =
    '<div class="c-card">' +
      '<div class="c-card__body">' +
        '<div class="l-cluster l-cluster--between">' +
          '<p class="js-text"></p>' +
          '<a class="c-btn c-btn--primary" href="purchase.html">Proceed to checkout</a>' +
        '</div>' +
      '</div>' +
    '</div>';

  box.querySelector('.js-text').textContent = 'The cart contains ' + cart.ticketsCount + ' tickets.';
}


function createEmptyState() {
  const box = document.createElement('div');
  box.className = 'c-empty';
  box.innerHTML =
    '<div class="c-empty__icon"><svg class="c-icon c-icon--lg" aria-hidden="true"><use href="kit/icons.svg#icon-ticket"></use></svg></div>' +
    '<h2 class="c-empty__title">There are no bookings yet</h2>' +
    '<div class="c-empty__action"><a class="c-btn c-btn--primary" href="index.html">Browse movies</a></div>';
  return box;
}
