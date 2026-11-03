// js/pages/session.js —— 选座页 第 11 章
//
// 参考标记：S06a（已选座）、S06b（座位被抢）、S06c（达到上限）、S06d（已停售）、S06e（游客）
//
// 【笨办法】每次选座/取消成功后，把座位图和右侧汇总整块重新拉一遍。
// 好处：不用在本地猜加了还是减了，界面永远等于服务端的真实状态

import { request, isLoggedIn } from '../api.js';
import { getConfig } from '../config.js';
import {
  setTimeZone, formatWeekdayShortDate, formatTimeRange, formatTime,
  formatAgeRating, formatFormat, formatMoney, formatSeat, formatSeatType,
  formatCountdown
} from '../format.js';
import { initHeader } from '../auth.js';
import { showAlert, clearAlerts, showApiError, showToast } from '../ui.js';

// 页面级变量：一次只处理一个场次
let session = null;
let config = null;
let timerId = null;

main();

async function main() {
  config = await getConfig();
  setTimeZone(config.timeZone);
  initHeader();

  const params = new URLSearchParams(location.search);
  const sessionId = params.get('id');

  if (sessionId === null) {
    document.querySelector('#session-title').textContent = 'Session not found';
    return;
  }

  try {
    session = await request('/sessions/' + sessionId);
  } catch (error) {
    document.querySelector('#session-title').textContent = 'Session not found';
    showToast('The session was not found.', 'danger');
    return;
  }

  fillTitle();
  await refreshSeatMap();
}


// ---------------------------------------------------------------------------
// 页面标题
// ---------------------------------------------------------------------------

function fillTitle() {
  document.querySelector('#back-link').href = 'movie.html?id=' + session.movie.id;
  document.querySelector('#session-title').textContent = session.movie.title;

  // 11.1.2：日期 + 时间段
  document.querySelector('#session-date').textContent =
    formatWeekdayShortDate(session.startsAt) + ' · ' + formatTimeRange(session.startsAt, session.endsAt);

  document.querySelector('#session-format').textContent = formatFormat(session.format);
  document.querySelector('#session-hall').textContent = session.hall.name;
  document.querySelector('#session-age').textContent = formatAgeRating(session.movie.ageRating);

  document.querySelector('#summary-note').textContent =
    'Up to ' + config.maxSeatsPerSession + ' seats per session. Booking closes at ' +
    formatTime(session.bookingClosesAt) + '.';
}


// ---------------------------------------------------------------------------
// 拉座位图 + 购物车，然后整块重画。
// ---------------------------------------------------------------------------

async function refreshSeatMap() {
  let seatMap;

  try {
    seatMap = await request('/sessions/' + session.id + '/seats');
  } catch (error) {
    showApiError(error, document.querySelector('#seats-alert'));
    return;
  }

  // 购物车只有登录用户才需要（拿倒计时用）
  let cart = null;
  if (isLoggedIn()) {
    try {
      cart = await request('/cart');
    } catch (error) {
      cart = null;
    }
  }

  fillLegend();
  drawSeatMap(seatMap);
  drawSummary(seatMap);
  showPageAlerts(seatMap);
  updateTimer(cart);
}


function fillLegend() {
  document.querySelector('#legend-standard').textContent = 'Standard · ' + formatMoney(session.prices.standard);
  document.querySelector('#legend-vip').textContent = 'VIP · ' + formatMoney(session.prices.vip);
}


// ---------------------------------------------------------------------------
// 画座位图
// ---------------------------------------------------------------------------

function drawSeatMap(seatMap) {
  const seatmap = document.querySelector('#seatmap');
  const rowsBox = document.querySelector('#seatmap-rows');
  const closed = session.isBookingOpen === false;

  // 列数用行内自定义属性。
  seatmap.setAttribute('style', '--seat-cols: ' + seatMap.seatsPerRow);
  rowsBox.textContent = '';

  // 先把平铺的座位按行分到二维数组里
  const rows = [];
  let r;
  for (r = 0; r < seatMap.rowsCount; r++) {
    rows[r] = [];
  }
  let i;
  for (i = 0; i < seatMap.seats.length; i++) {
    const seat = seatMap.seats[i];
    rows[seat.row - 1].push(seat);
  }

  // 一行一行画
  for (r = 0; r < rows.length; r++) {
    const rowElement = document.createElement('div');
    rowElement.className = 'c-seatmap__row';

    const leftLabel = document.createElement('span');
    leftLabel.className = 'c-seatmap__label';
    leftLabel.setAttribute('aria-hidden', 'true');
    leftLabel.textContent = r + 1;
    rowElement.appendChild(leftLabel);

    for (i = 0; i < rows[r].length; i++) {
      rowElement.appendChild(createSeatButton(rows[r][i], closed));
    }

    const rightLabel = document.createElement('span');
    rightLabel.className = 'c-seatmap__label';
    rightLabel.setAttribute('aria-hidden', 'true');
    rightLabel.textContent = r + 1;
    rowElement.appendChild(rightLabel);

    rowsBox.appendChild(rowElement);
  }
}


// 一个座位按钮
function createSeatButton(seat, closed) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'c-seat';

  if (seat.type === 'Vip') {
    button.className = 'c-seat c-seat--vip';
  }

  // 已占用：禁用，不给点击
  if (seat.status === 'Occupied') {
    button.disabled = true;
    button.setAttribute('aria-label', formatSeat(seat.row, seat.number) + ', occupied');
    return button;
  }

  // 在购物车里 → aria-pressed=true
  if (seat.status === 'InMyCart') {
    button.setAttribute('aria-pressed', 'true');
  } else {
    button.setAttribute('aria-pressed', 'false');
  }

  button.setAttribute(
    'aria-label',
    formatSeat(seat.row, seat.number) + ', ' + formatSeatType(seat.type) + ', ' + formatMoney(seat.price)
  );

  // 本场次已停止售票 → 所有座位都不可点。
  if (closed === true) {
    button.disabled = true;
    return button;
  }

  button.addEventListener('click', function () {
    handleSeatClick(seat);
  });

  return button;
}


// 点座位：空座 → 加；自己的座 → 删
async function handleSeatClick(seat) {
  if (isLoggedIn() === false) {
    return; // 游客不给点（页面上已经有提示）
  }

  try {
    if (seat.status === 'InMyCart') {
      await request('/cart/items/' + seat.cartItemId, { method: 'DELETE' });
    } else {
      await request('/cart/items', {
        method: 'POST',
        body: { sessionId: session.id, row: seat.row, number: seat.number }
      });
    }

    await refreshSeatMap();
  } catch (error) {
    // 座位被别人抢走 / 已经在车里：提示 + 重画。
    if (error.code === 'SEAT_OCCUPIED' || error.code === 'ALREADY_IN_CART') {
      showToast(error.detail, 'danger');
      await refreshSeatMap();
      return;
    }

    // 达到单场上限
    if (error.code === 'CART_LIMIT_EXCEEDED') {
      showAlert(
        document.querySelector('#seats-alert'),
        'You have selected the maximum of ' + config.maxSeatsPerSession + ' seats for this session.',
        'warning'
      );
      return;
    }

    // 本场次停止售票
    if (error.code === 'BOOKING_CLOSED') {
      session.isBookingOpen = false;
      showToast(error.detail, 'danger');
      await refreshSeatMap();
      return;
    }

    showToast(error.detail, 'danger');
  }
}


// ---------------------------------------------------------------------------
// 右侧汇总
// ---------------------------------------------------------------------------

function drawSummary(seatMap) {
  const list = document.querySelector('#summary-list');
  list.textContent = '';

  // 只统计本场次里我的座位。
  const mine = [];
  let i;
  for (i = 0; i < seatMap.seats.length; i++) {
    if (seatMap.seats[i].status === 'InMyCart') {
      mine.push(seatMap.seats[i]);
    }
  }

  let total = 0;
  for (i = 0; i < mine.length; i++) {
    total = total + mine[i].price;
    list.appendChild(createSummaryRow(mine[i]));
  }

  document.querySelector('#summary-tickets').textContent = mine.length;
  document.querySelector('#summary-total').textContent = formatMoney(total);
}


function createSummaryRow(seat) {
  const item = document.createElement('li');
  item.className = 'c-cart-seat';
  item.innerHTML =
    '<span class="c-cart-seat__label"></span>' +
    '<span class="c-badge c-badge--neutral"></span>' +
    '<span class="c-cart-seat__price"></span>' +
    '<button class="c-btn c-btn--ghost c-btn--icon c-btn--sm" type="button">' +
    '<svg class="c-icon c-icon--sm" aria-hidden="true"><use href="kit/icons.svg#icon-trash"></use></svg>' +
    '</button>';

  item.querySelector('.c-cart-seat__label').textContent = formatSeat(seat.row, seat.number);
  item.querySelector('.c-badge').textContent = formatSeatType(seat.type);
  item.querySelector('.c-cart-seat__price').textContent = formatMoney(seat.price);

  const removeButton = item.querySelector('button');
  removeButton.setAttribute('aria-label', 'Remove ' + formatSeat(seat.row, seat.number).toLowerCase());
  removeButton.addEventListener('click', function () {
    handleSeatClick(seat);
  });

  return item;
}


// ---------------------------------------------------------------------------
// 页面提示：已停售 / 游客 / 达到上限。
// ---------------------------------------------------------------------------

function showPageAlerts(seatMap) {
  const alertBox = document.querySelector('#seats-alert');

  // 1. 本场次已停止售票。
  if (session.isBookingOpen === false) {
    showAlert(
      alertBox,
      'Booking for this session closed at ' + formatTime(session.bookingClosesAt) + '.',
      'danger'
    );
    document.querySelector('#summary-actions').innerHTML =
      '<a class="c-btn c-btn--secondary c-btn--block" href="movie.html?id=' + session.movie.id +
      '">Choose another session</a>';
    return;
  }

  // 2. 游客
  if (isLoggedIn() === false) {
    showAlert(
      alertBox,
      'Log in to select seats.',
      'info',
      'Log in',
      'login.html?returnUrl=' + encodeURIComponent('session.html?id=' + session.id)
    );
    return;
  }

  // 3. 已经选到上限
  let count = 0;
  let i;
  for (i = 0; i < seatMap.seats.length; i++) {
    if (seatMap.seats[i].status === 'InMyCart') {
      count = count + 1;
    }
  }

  if (count >= config.maxSeatsPerSession) {
    showAlert(
      alertBox,
      'You have selected the maximum of ' + config.maxSeatsPerSession + ' seats for this session.',
      'warning'
    );
    return;
  }

  clearAlerts(alertBox);
}


// ---------------------------------------------------------------------------
// 倒计时（规格书 11.3.2）
// ---------------------------------------------------------------------------

function updateTimer(cart) {
  const timerBox = document.querySelector('#timer');
  const timerText = document.querySelector('#timer-text');

  // 先清掉上一次的定时器，避免越叠越多
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }

  // 购物车里没有任何保留 → 不显示倒计时
  if (cart === null || cart.holdExpiresAt === null) {
    timerBox.hidden = true;
    return;
  }

  const holdUntil = new Date(cart.holdExpiresAt).getTime();
  const holdTimeText = formatTime(cart.holdExpiresAt);

  timerBox.hidden = false;
  drawTimer();

  timerId = setInterval(function () {
    if (drawTimer() === true) {
      clearInterval(timerId);
      timerId = null;
      refreshSeatMap(); // 归零：重新拉购物车和座位图
    }
  }, 1000);

  function drawTimer() {
    const leftMilliseconds = holdUntil - Date.now();
    const leftSeconds = Math.floor(leftMilliseconds / 1000);

    timerText.textContent = 'Held until ' + holdTimeText + ' · ' + formatCountdown(leftSeconds) + ' left';

    // 剩不到 2 分钟 → 加 is-warning
    if (leftMilliseconds < 120000) {
      timerBox.classList.add('is-warning');
    } else {
      timerBox.classList.remove('is-warning');
    }

    if (leftMilliseconds <= 0) {
      timerBox.classList.add('is-expired');
      return true;
    }
    return false;
  }
}
