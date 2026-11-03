import { request } from '../api.js';
import { getConfig } from '../config.js';
import {
  setTimeZone, formatSessionDateTime, formatTime, formatFormat,
  formatAgeRating, formatMoney, formatSeat, formatSeatType, formatCountdown
} from '../format.js';
import { requireAuth, initHeader, updateCartCounter } from '../auth.js';
import { groupItemsBySession } from '../cart-groups.js';
import { showAlert, clearAlerts, showApiError, showToast } from '../ui.js';

let cart = null;
let timerId = null;
let lastTicketsCount = 0;

if (requireAuth()) {
  start();
}

async function start() {
  const config = await getConfig();
  setTimeZone(config.timeZone);
  initHeader();

  document.querySelector('#clear-cart').addEventListener('click', function () {
    clearCart();
  });

  await refreshCart();
}


// load the cart and redraw
async function refreshCart() {
  try {
    cart = await request('/cart');
  } catch (error) {
    showApiError(error, document.querySelector('#cart-alert'));
    return;
  }

  lastTicketsCount = cart.ticketsCount;

  drawSubtitle();
  drawGroups();
  drawSummary();
  updateTimer();
}


function drawSubtitle() {
  document.querySelector('#cart-subtitle').textContent = cart.ticketsCount + ' tickets';
}


function drawSummary() {
  document.querySelector('#summary-tickets').textContent = cart.ticketsCount;
  document.querySelector('#summary-total').textContent = formatMoney(cart.totalPrice);
}


function drawGroups() {
  const groupsBox = document.querySelector('#cart-groups');
  const emptyBox = document.querySelector('#cart-empty');

  groupsBox.textContent = '';
  emptyBox.textContent = '';

  if (cart.items.length === 0) {
    emptyBox.appendChild(createEmptyState());
    return;
  }

  const groups = groupItemsBySession(cart.items);

  let i;
  for (i = 0; i < groups.length; i++) {
    groupsBox.appendChild(createGroup(groups[i]));
  }
}


function createGroup(group) {
  const article = document.createElement('article');
  article.className = 'c-cart-group';
  article.innerHTML =
    '<header class="c-cart-group__header">' +
      '<div class="c-poster c-poster--xs"><img class="c-poster__img" alt="" width="400" height="600"></div>' +
      '<div class="c-cart-group__info">' +
        '<h3 class="c-cart-group__title"><a></a></h3>' +
        '<p class="c-cart-group__meta">' +
          '<span class="js-date"></span>' +
          '<span class="c-format"></span>' +
          '<span class="js-hall"></span>' +
          '<span class="c-age"></span>' +
        '</p>' +
      '</div>' +
    '</header>' +
    '<ul class="c-cart-group__seats"></ul>' +
    '<footer class="c-cart-group__footer"><span>Subtotal</span><span class="js-subtotal"></span></footer>';

  const session = group.session;

  article.querySelector('.c-poster__img').src = session.posterUrl;

  const titleLink = article.querySelector('.c-cart-group__title a');
  titleLink.textContent = session.movieTitle;
  titleLink.href = 'session.html?id=' + session.id;

  article.querySelector('.js-date').textContent = formatSessionDateTime(session.startsAt);
  article.querySelector('.c-format').textContent = formatFormat(session.format);
  article.querySelector('.js-hall').textContent = session.hallName;
  article.querySelector('.c-age').textContent = formatAgeRating(session.ageRating);
  article.querySelector('.js-subtotal').textContent = formatMoney(group.subtotal);

  const seatsBox = article.querySelector('.c-cart-group__seats');
  let i;
  for (i = 0; i < group.items.length; i++) {
    seatsBox.appendChild(createSeatRow(group.items[i]));
  }

  return article;
}


function createSeatRow(item) {
  const row = document.createElement('li');
  row.className = 'c-cart-seat';
  row.innerHTML =
    '<span class="c-cart-seat__label"></span>' +
    '<span class="c-badge c-badge--neutral"></span>' +
    '<span class="c-cart-seat__price"></span>' +
    '<button class="c-btn c-btn--ghost c-btn--icon c-btn--sm" type="button">' +
    '<svg class="c-icon c-icon--sm" aria-hidden="true"><use href="kit/icons.svg#icon-trash"></use></svg>' +
    '</button>';

  row.querySelector('.c-cart-seat__label').textContent = formatSeat(item.row, item.number);
  row.querySelector('.c-badge').textContent = formatSeatType(item.seatType);
  row.querySelector('.c-cart-seat__price').textContent = formatMoney(item.price);

  const removeButton = row.querySelector('button');
  removeButton.setAttribute('aria-label', 'Remove ' + formatSeat(item.row, item.number).toLowerCase());
  removeButton.addEventListener('click', function () {
    removeItem(item);
  });

  return row;
}


function createEmptyState() {
  const box = document.createElement('div');
  box.className = 'c-empty';
  box.innerHTML =
    '<div class="c-empty__icon"><svg class="c-icon c-icon--lg" aria-hidden="true"><use href="kit/icons.svg#icon-cart"></use></svg></div>' +
    '<h2 class="c-empty__title">The cart is empty</h2>' +
    '<p class="c-empty__text">Select seats on a session page to add them to the cart.</p>' +
    '<div class="c-empty__action"><a class="c-btn c-btn--primary" href="index.html">Browse movies</a></div>';
  return box;
}


// remove one seat
async function removeItem(item) {
  try {
    await request('/cart/items/' + item.id, { method: 'DELETE' });
  } catch (error) {
    showApiError(error, document.querySelector('#cart-alert'));
    return;
  }

  await updateCartAfterChange();
}


async function clearCart() {
  try {
    await request('/cart', { method: 'DELETE' });
  } catch (error) {
    showApiError(error, document.querySelector('#cart-alert'));
    return;
  }

  await updateCartAfterChange();
}


async function updateCartAfterChange() {
  await refreshCart();
  await updateCartCounter();
}


// countdown of the hold
function updateTimer() {
  const timerBox = document.querySelector('#timer');
  const timerText = document.querySelector('#timer-text');

  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }

  if (cart.items.length === 0 || cart.holdExpiresAt === null) {
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
      handleHoldExpired();
    }
  }, 1000);

  function drawTimer() {
    const leftMilliseconds = holdUntil - Date.now();

    timerText.textContent = 'Seats are held until ' + holdTimeText + ' · ' +
      formatCountdown(Math.floor(leftMilliseconds / 1000)) + ' left';

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


async function handleHoldExpired() {
  const before = lastTicketsCount;

  await refreshCart();

  const removed = before - lastTicketsCount;

  if (removed > 0) {
    showAlert(
      document.querySelector('#cart-alert'),
      'The hold of ' + removed + ' seats has expired. They were removed from the cart.',
      'warning'
    );
  }
}
