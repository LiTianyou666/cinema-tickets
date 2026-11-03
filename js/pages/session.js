import { request, isLoggedIn } from '../api.js';
import { getConfig } from '../config.js';
import {
  setTimeZone, formatWeekdayShortDate, formatTimeRange, formatTime,
  formatAgeRating, formatFormat, formatMoney, formatSeat, formatSeatType,
  formatCountdown
} from '../format.js';
import { initHeader } from '../auth.js';
import { showAlert, clearAlerts, showApiError, showToast } from '../ui.js';

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


function fillTitle() {
  document.querySelector('#back-link').href = 'movie.html?id=' + session.movie.id;
  document.querySelector('#session-title').textContent = session.movie.title;

  document.querySelector('#session-date').textContent =
    formatWeekdayShortDate(session.startsAt) + ' · ' + formatTimeRange(session.startsAt, session.endsAt);

  document.querySelector('#session-format').textContent = formatFormat(session.format);
  document.querySelector('#session-hall').textContent = session.hall.name;
  document.querySelector('#session-age').textContent = formatAgeRating(session.movie.ageRating);

  document.querySelector('#summary-note').textContent =
    'Up to ' + config.maxSeatsPerSession + ' seats per session. Booking closes at ' +
    formatTime(session.bookingClosesAt) + '.';
}


// load seats and cart, then redraw everything
async function refreshSeatMap() {
  let seatMap;

  try {
    seatMap = await request('/sessions/' + session.id + '/seats');
  } catch (error) {
    showApiError(error, document.querySelector('#seats-alert'));
    return;
  }

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


function drawSeatMap(seatMap) {
  const seatmap = document.querySelector('#seatmap');
  const rowsBox = document.querySelector('#seatmap-rows');
  const closed = session.isBookingOpen === false;

  seatmap.setAttribute('style', '--seat-cols: ' + seatMap.seatsPerRow);
  rowsBox.textContent = '';

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


function createSeatButton(seat, closed) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'c-seat';

  if (seat.type === 'Vip') {
    button.className = 'c-seat c-seat--vip';
  }

  if (seat.status === 'Occupied') {
    button.disabled = true;
    button.setAttribute('aria-label', formatSeat(seat.row, seat.number) + ', occupied');
    return button;
  }

  if (seat.status === 'InMyCart') {
    button.setAttribute('aria-pressed', 'true');
  } else {
    button.setAttribute('aria-pressed', 'false');
  }

  button.setAttribute(
    'aria-label',
    formatSeat(seat.row, seat.number) + ', ' + formatSeatType(seat.type) + ', ' + formatMoney(seat.price)
  );

  if (closed === true) {
    button.disabled = true;
    return button;
  }

  button.addEventListener('click', function () {
    handleSeatClick(seat);
  });

  return button;
}


async function handleSeatClick(seat) {
  if (isLoggedIn() === false) {
    return;
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
    if (error.code === 'SEAT_OCCUPIED' || error.code === 'ALREADY_IN_CART') {
      showToast(error.detail, 'danger');
      await refreshSeatMap();
      return;
    }

    if (error.code === 'CART_LIMIT_EXCEEDED') {
      showAlert(
        document.querySelector('#seats-alert'),
        'You have selected the maximum of ' + config.maxSeatsPerSession + ' seats for this session.',
        'warning'
      );
      return;
    }

    if (error.code === 'BOOKING_CLOSED') {
      session.isBookingOpen = false;
      showToast(error.detail, 'danger');
      await refreshSeatMap();
      return;
    }

    showToast(error.detail, 'danger');
  }
}


function drawSummary(seatMap) {
  const list = document.querySelector('#summary-list');
  list.textContent = '';

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


function showPageAlerts(seatMap) {
  const alertBox = document.querySelector('#seats-alert');

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


function updateTimer(cart) {
  const timerBox = document.querySelector('#timer');
  const timerText = document.querySelector('#timer-text');

  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }

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
      refreshSeatMap();
    }
  }, 1000);

  function drawTimer() {
    const leftMilliseconds = holdUntil - Date.now();
    const leftSeconds = Math.floor(leftMilliseconds / 1000);

    timerText.textContent = 'Held until ' + holdTimeText + ' · ' + formatCountdown(leftSeconds) + ' left';

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
