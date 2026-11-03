// js/pages/booking.js —— 订单详情页 第 15 章
//
// 参考标记：S10a（Active）、S10b（Cancelled）、S10c（Completed）、S10d（找不到）
//
// 整块内容都用 JS 生成（数据全是接口给的，页面里没什么静态内容）

import { request } from '../api.js';
import { getConfig } from '../config.js';
import {
  setTimeZone, formatDate, formatDateTime, formatTimeRange, formatFormat,
  formatAgeRating, formatMoney, formatDiscount, formatTickets, formatSeatType,
  formatBookingStatus, getStatusClass
} from '../format.js';
import { requireAuth, initHeader } from '../auth.js';
import { showAlert, showToast } from '../ui.js';

let config = null;
let booking = null;

// 受限页面 5.2.1
if (requireAuth()) {
  start();
}

async function start() {
  config = await getConfig();
  setTimeZone(config.timeZone);
  initHeader();

  setupDialog();

  const params = new URLSearchParams(location.search);
  const bookingId = params.get('id');

  if (bookingId === null) {
    showNotFound();
    return;
  }

  try {
    booking = await request('/bookings/' + bookingId);
  } catch (error) {
    // 404 和 403 都按找不到处理 15.1
    showNotFound();
    return;
  }

  drawPage();

  if (booking.status === 'Completed') {
    await checkReviewAllowed();
  }
}


// ---------------------------------------------------------------------------
// 页面骨架
// ---------------------------------------------------------------------------

function drawPage() {
  const content = document.querySelector('#booking-content');
  content.textContent = '';

  content.appendChild(createTitleBlock());
  content.appendChild(createSessionCard());
  content.appendChild(createDetailsCard());
  content.appendChild(createTicketsCard());

  // 已完成的订单可能要显示可以写影评的提示，先留个位置
  const reviewBox = document.createElement('div');
  reviewBox.id = 'review-alert';
  reviewBox.hidden = true;
  content.appendChild(reviewBox);
}


// 标题 + 状态 + 取消按钮
function createTitleBlock() {
  const block = document.createElement('div');
  block.className = 'c-page-title';
  block.innerHTML =
    '<div class="c-page-title__main">' +
      '<div class="c-page-title__head">' +
        '<h1></h1>' +
        '<span class="c-status"></span>' +
      '</div>' +
    '</div>' +
    '<div class="c-page-title__actions"></div>';

  block.querySelector('h1').textContent = 'Booking ' + booking.code;

  const statusSpan = block.querySelector('.c-status');
  statusSpan.className = 'c-status ' + getStatusClass(booking.status);
  statusSpan.textContent = formatBookingStatus(booking.status);

  // 取消按钮只在这时显示：Active 且还没过取消截止时间（和列表页同一规则）
  const deadline = new Date(booking.session.startsAt).getTime() -
    config.cancellationCutoffMinutes * 60 * 1000;

  if (booking.status === 'Active' && deadline > Date.now()) {
    const button = document.createElement('button');
    button.className = 'c-btn c-btn--secondary c-btn--danger';
    button.type = 'button';
    button.textContent = 'Cancel booking';
    button.addEventListener('click', openCancelDialog);
    block.querySelector('.c-page-title__actions').appendChild(button);
  }

  return block;
}


// 场次卡
function createSessionCard() {
  const card = document.createElement('section');
  card.className = 'c-card';
  card.innerHTML =
    '<div class="c-card__body">' +
      '<div class="l-media l-media--sm">' +
        '<div class="c-poster c-poster--sm"><img class="c-poster__img" alt="" width="400" height="600"></div>' +
        '<div class="l-stack">' +
          '<h2 class="c-card__title"><a></a></h2>' +
          '<div class="l-cluster">' +
            '<span class="c-page-title__item"><svg class="c-icon c-icon--sm" aria-hidden="true"><use href="kit/icons.svg#icon-calendar"></use></svg><span class="js-date"></span></span>' +
            '<span class="c-format"></span>' +
            '<span class="c-page-title__item"><svg class="c-icon c-icon--sm" aria-hidden="true"><use href="kit/icons.svg#icon-hall"></use></svg><span class="js-hall"></span></span>' +
            '<span class="c-age"></span>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  card.querySelector('.c-poster__img').src = booking.movie.posterUrl;

  const titleLink = card.querySelector('.c-card__title a');
  titleLink.textContent = booking.movie.title;
  titleLink.href = 'movie.html?id=' + booking.movie.id;

  card.querySelector('.js-date').textContent =
    formatDate(booking.session.startsAt) + ' · ' +
    formatTimeRange(booking.session.startsAt, booking.session.endsAt);

  card.querySelector('.c-format').textContent = formatFormat(booking.session.format);
  card.querySelector('.js-hall').textContent = booking.session.hallName;
  card.querySelector('.c-age').textContent = formatAgeRating(booking.movie.ageRating);

  return card;
}


// Details 块
function createDetailsCard() {
  const card = document.createElement('section');
  card.className = 'c-card';
  card.innerHTML =
    '<div class="c-card__header"><h2 class="c-card__title">Details</h2></div>' +
    '<div class="c-card__body"><dl class="c-dl" id="details-list"></dl></div>';

  const list = card.querySelector('#details-list');

  addDetailRow(list, 'Booking code', booking.code);
  addDetailRow(list, 'Created', formatDateTime(booking.createdAt));

  // 已取消的才有取消时间
  if (booking.cancelledAt !== null) {
    addDetailRow(list, 'Cancelled', formatDateTime(booking.cancelledAt));
  }

  addDetailRow(list, 'Payment method', booking.paymentMethod);
  addDetailRow(list, 'Contact email', booking.contactEmail);
  addDetailRow(list, 'Contact phone', booking.contactPhone);

  // 优惠码：WELCOME10, 10% 或 —（没优惠码时接口给的是 null 或空字符串）
  if (booking.promoCode === null || booking.promoCode === '') {
    addDetailRow(list, 'Promo code', '—');
  } else {
    addDetailRow(list, 'Promo code', booking.promoCode + ', ' + booking.discountPercent + '%');
  }

  return card;
}


function addDetailRow(list, term, value) {
  const row = document.createElement('div');
  row.className = 'c-dl__row';
  row.innerHTML = '<dt class="c-dl__term"></dt><dd class="c-dl__desc"></dd>';
  row.querySelector('.c-dl__term').textContent = term;
  row.querySelector('.c-dl__desc').textContent = value;
  list.appendChild(row);
}


// Tickets 表格
function createTicketsCard() {
  const card = document.createElement('section');
  card.className = 'c-card';
  card.innerHTML =
    '<div class="c-card__header">' +
      '<h2 class="c-card__title">Tickets</h2>' +
      '<span class="u-muted js-count"></span>' +
    '</div>' +
    '<div class="c-card__body">' +
      '<table class="c-table">' +
        '<thead><tr>' +
          '<th scope="col">Row</th>' +
          '<th scope="col">Seat</th>' +
          '<th scope="col">Type</th>' +
          '<th scope="col" class="c-table__num">Price</th>' +
        '</tr></thead>' +
        '<tbody id="ticket-rows"></tbody>' +
        '<tfoot id="ticket-foot"></tfoot>' +
      '</table>' +
    '</div>';

  card.querySelector('.js-count').textContent = formatTickets(booking.ticketsCount);

  const tbody = card.querySelector('#ticket-rows');

  let i;
  for (i = 0; i < booking.tickets.length; i++) {
    const ticket = booking.tickets[i];
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td></td><td></td><td></td><td class="c-table__num"></td>';

    tr.children[0].textContent = ticket.row;
    tr.children[1].textContent = ticket.number;
    tr.children[2].textContent = formatSeatType(ticket.seatType);
    tr.children[3].textContent = formatMoney(ticket.price);

    tbody.appendChild(tr);
  }

  // 表尾：小计 / 折扣 / 合计
  const tfoot = card.querySelector('#ticket-foot');
  addFootRow(tfoot, 'Subtotal', formatMoney(booking.subtotal), '');

  if (booking.discountAmount > 0) {
    addFootRow(tfoot, 'Discount (' + booking.discountPercent + '%)',
      formatDiscount(booking.discountAmount), 'c-table__foot-row--discount');
  }

  addFootRow(tfoot, 'Total', formatMoney(booking.total), 'c-table__foot-row--total');

  return card;
}


function addFootRow(tfoot, label, value, extraClass) {
  const tr = document.createElement('tr');
  tr.className = 'c-table__foot-row';

  if (extraClass !== '') {
    tr.className = 'c-table__foot-row ' + extraClass;
  }

  tr.innerHTML = '<th scope="row" colspan="3"></th><td class="c-table__num"></td>';
  tr.querySelector('th').textContent = label;
  tr.querySelector('td').textContent = value;

  tfoot.appendChild(tr);
}


// ---------------------------------------------------------------------------
// 已完成的订单：能不能写影评 15.7
// ---------------------------------------------------------------------------

async function checkReviewAllowed() {
  let check;

  try {
    check = await request('/movies/' + booking.movie.id + '/reviews/check');
  } catch (error) {
    return;
  }

  if (check.eligibility !== 'Allowed') {
    return;
  }

  const box = document.querySelector('#review-alert');
  box.hidden = false;
  box.textContent = '';

  showAlert(
    box,
    'The session has taken place. You can review the movie.',
    'info',
    'Review the movie',
    'movie.html?id=' + booking.movie.id
  );
}


// ---------------------------------------------------------------------------
// 取消订单
// ---------------------------------------------------------------------------

function setupDialog() {
  const dialog = document.querySelector('#cancel-dialog');

  dialog.querySelector('#keep-booking').addEventListener('click', function () {
    dialog.close();
  });

  dialog.querySelector('#confirm-cancel').addEventListener('click', cancelBooking);
}


function openCancelDialog() {
  const dialog = document.querySelector('#cancel-dialog');
  dialog.querySelector('#cancel-dialog-title').textContent = 'Cancel booking ' + booking.code + '?';
  dialog.showModal();
}


async function cancelBooking() {
  document.querySelector('#cancel-dialog').close();

  try {
    await request('/bookings/' + booking.id + '/cancel', { method: 'POST' });
    showToast('The booking ' + booking.code + ' is cancelled.', 'success');

    // 重新拿一次详情，页面显示已取消状态 15.6
    booking = await request('/bookings/' + booking.id);
    drawPage();
  } catch (error) {
    showToast(error.detail, 'danger');
  }
}


// ---------------------------------------------------------------------------
// 找不到（404 / 403）
// ---------------------------------------------------------------------------

function showNotFound() {
  const content = document.querySelector('#booking-content');
  content.textContent = '';

  const box = document.createElement('div');
  box.className = 'c-empty c-empty--error';
  box.innerHTML =
    '<div class="c-empty__icon"><svg class="c-icon c-icon--lg" aria-hidden="true"><use href="kit/icons.svg#icon-error"></use></svg></div>' +
    '<h2 class="c-empty__title">The booking was not found</h2>' +
    '<div class="c-empty__action"><a class="c-btn c-btn--secondary" href="bookings.html">All bookings</a></div>';

  content.appendChild(box);
}
