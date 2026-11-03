// js/pages/purchase.js —— 结算页 第 13 章
//
// 参考标记：S08a（默认）、S08b（优惠码已应用）、S08c（优惠码被拒）、S08d（某场次已关闭）
//
// 三件事：
//   1. 显示资料（只读）+ 支付方式 + 优惠码
//   2. 检查每个场次是否还来得及订（开场前 bookingCutoffMinutes 停止售票）
//   3. 点 Confirm booking → POST /api/bookings → 跳订单页

import { request } from '../api.js';
import { getConfig } from '../config.js';
import {
  setTimeZone, formatSessionDateTime, formatFormat, formatAgeRating,
  formatMoney, formatSeat, formatSeatType, formatTime, formatDiscount
} from '../format.js';
import { requireAuth, initHeader } from '../auth.js';
import { groupItemsBySession } from '../cart-groups.js';
import { showAlert, clearAlerts, showApiError, showToast, setLoading } from '../ui.js';

let config = null;
let cart = null;
let appliedPromo = null;      // 优惠码校验成功后的结果
let closedSessionIds = [];    // 已经不能订的场次 id

// 受限页面：没登录直接跳登录页（规格书 5.2.1）
if (requireAuth()) {
  start();
}

async function start() {
  config = await getConfig();
  setTimeZone(config.timeZone);
  initHeader();

  let profile;

  try {
    profile = await request('/account/profile');
    cart = await request('/cart');
  } catch (error) {
    showApiError(error, document.querySelector('#checkout-alert'));
    return;
  }

  // 空车直接回购物车 13.1
  if (cart.items.length === 0) {
    location.href = 'cart.html';
    return;
  }

  fillContact(profile);

  document.querySelector('#summary-note').textContent =
    'Booking closes ' + config.bookingCutoffMinutes + ' minutes before the session start.';

  checkSessions();
  drawGroups();
  drawSummary();
  setupPromo();
  setupForm();
}


// ---------------------------------------------------------------------------
// 联系方式（只读）
// ---------------------------------------------------------------------------

function fillContact(profile) {
  document.querySelector('#contact-name').textContent = profile.fullName;
  document.querySelector('#contact-email').textContent = profile.email;
  document.querySelector('#contact-phone').textContent = profile.phoneNumber;
}


// ---------------------------------------------------------------------------
// 场次时间校验（规格书 13.6）
// ---------------------------------------------------------------------------

function checkSessions() {
  closedSessionIds = [];

  const now = Date.now();
  const cutoffMilliseconds = config.bookingCutoffMinutes * 60 * 1000;

  let i;
  for (i = 0; i < cart.items.length; i++) {
    const item = cart.items[i];
    const startsAt = new Date(item.session.startsAt).getTime();

    // 必须满足：开场时间 > 现在 + 截止分钟数
    if (startsAt - cutoffMilliseconds <= now) {
      if (closedSessionIds.indexOf(item.session.id) === -1) {
        closedSessionIds.push(item.session.id);
      }
    }
  }
}


// 这个场次几点停止售票（开场时间往前提 cutoff 分钟）
function getClosingTimeText(sessionStartsAt) {
  const closesAt = new Date(new Date(sessionStartsAt).getTime() - config.bookingCutoffMinutes * 60000);
  return formatTime(closesAt.toISOString());
}


// ---------------------------------------------------------------------------
// 票（购物车分组，不带删除按钮）
// ---------------------------------------------------------------------------

function drawGroups() {
  const box = document.querySelector('#ticket-groups');
  box.textContent = '';

  const groups = groupItemsBySession(cart.items);

  let i;
  for (i = 0; i < groups.length; i++) {
    box.appendChild(createGroup(groups[i]));
  }
}


function createGroup(group) {
  const session = group.session;
  const closed = closedSessionIds.indexOf(session.id) !== -1;

  const article = document.createElement('article');
  article.className = 'c-cart-group';

  if (closed === true) {
    article.className = 'c-cart-group is-error';
  }

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

  // 场次已经不能订 → 加一行错误说明
  if (closed === true) {
    const errorLine = document.createElement('p');
    errorLine.className = 'c-cart-group__error';
    errorLine.textContent = 'Booking closed at ' + getClosingTimeText(session.startsAt);
    article.appendChild(errorLine);
  }

  return article;
}


function createSeatRow(item) {
  const row = document.createElement('li');
  row.className = 'c-cart-seat';
  row.innerHTML =
    '<span class="c-cart-seat__label"></span>' +
    '<span class="c-badge c-badge--neutral"></span>' +
    '<span class="c-cart-seat__price"></span>';

  row.querySelector('.c-cart-seat__label').textContent = formatSeat(item.row, item.number);
  row.querySelector('.c-badge').textContent = formatSeatType(item.seatType);
  row.querySelector('.c-cart-seat__price').textContent = formatMoney(item.price);

  return row;
}


// ---------------------------------------------------------------------------
// 右侧 Summary
// ---------------------------------------------------------------------------

function drawSummary() {
  document.querySelector('#summary-subtotal').textContent = formatMoney(cart.totalPrice);

  const discountLine = document.querySelector('#summary-discount-line');

  if (appliedPromo === null) {
    discountLine.hidden = true;
    document.querySelector('#summary-total').textContent = formatMoney(cart.totalPrice);
    return;
  }

  // 有优惠码：显示折扣行，总额用服务端算好的
  discountLine.hidden = false;
  discountLine.querySelector('dt').textContent = 'Discount (' + appliedPromo.discountPercent + '%)';
  document.querySelector('#summary-discount').textContent = formatDiscount(appliedPromo.discountAmount);
  document.querySelector('#summary-total').textContent = formatMoney(appliedPromo.total);
}


// ---------------------------------------------------------------------------
// 优惠码
// ---------------------------------------------------------------------------

function setupPromo() {
  const input = document.querySelector('#promo-code');
  const applyButton = document.querySelector('#promo-apply');

  applyButton.addEventListener('click', async function () {
    const code = input.value.trim();

    if (code.length === 0) {
      showPromoFailure('The promo code must be 1 to 32 characters long.', input);
      return;
    }

    setLoading(applyButton, true);

    try {
      const result = await request('/promocodes/check', {
        method: 'POST',
        body: { code: code }
      });

      appliedPromo = result;
      showPromoApplied(result);
      drawSummary();
    } catch (error) {
      showPromoFailure(error.detail, input);
    } finally {
      setLoading(applyButton, false);
    }
  });
}


// 应用成功：输入框整块换成 CODE · 说明 + Remove
function showPromoApplied(result) {
  const box = document.querySelector('#promo');
  box.className = 'c-promo is-success';
  box.innerHTML =
    '<div class="c-promo__applied">' +
      '<svg class="c-icon" aria-hidden="true"><use href="kit/icons.svg#icon-check"></use></svg>' +
      '<span><span class="c-promo__code"></span> · <span class="js-promo-desc"></span></span>' +
      '<button class="c-btn c-btn--link" type="button" id="promo-remove">Remove</button>' +
    '</div>';

  box.querySelector('.c-promo__code').textContent = result.code;
  box.querySelector('.js-promo-desc').textContent = result.description;

  box.querySelector('#promo-remove').addEventListener('click', resetPromo);
}


// 移除优惠码：恢复输入框
function resetPromo() {
  appliedPromo = null;

  const box = document.querySelector('#promo');
  box.className = 'c-promo';
  box.innerHTML =
    '<div class="c-promo__form" id="promo-form">' +
      '<label class="u-visually-hidden" for="promo-code">Promo code</label>' +
      '<input class="c-input c-promo__input" id="promo-code" type="text" maxlength="32" placeholder="Enter the promo code">' +
      '<button class="c-btn c-btn--secondary" type="button" id="promo-apply">Apply</button>' +
    '</div>' +
    '<p class="c-promo__message" id="promo-message" hidden></p>';

  setupPromo();
  drawSummary();
}


function showPromoFailure(message, input) {
  const box = document.querySelector('#promo');
  const messageBox = document.querySelector('#promo-message');

  box.className = 'c-promo is-error';
  messageBox.textContent = message;
  messageBox.hidden = false;

  if (input !== null) {
    input.setAttribute('aria-invalid', 'true');
  }
}


// ---------------------------------------------------------------------------
// 提交订单
// ---------------------------------------------------------------------------

function setupForm() {
  const form = document.querySelector('#checkout-form');

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    submitBooking();
  });

  drawConfirmState();
  showClosedAlert();
}


// 有场次关闭时：确认按钮不可用 + 顶部警告
function drawConfirmState() {
  const button = document.querySelector('#confirm-button');

  if (closedSessionIds.length > 0) {
    button.disabled = true;
  } else {
    button.disabled = false;
  }
}


function showClosedAlert() {
  if (closedSessionIds.length === 0) {
    return;
  }

  showAlert(
    document.querySelector('#checkout-alert'),
    'Booking is closed for ' + closedSessionIds.length +
      ' session(s). Remove its seats from the cart to continue.',
    'danger',
    'Go to cart',
    'cart.html'
  );
}


async function submitBooking() {
  // 提交前再查一次时间 13.6
  checkSessions();
  drawGroups();
  drawConfirmState();
  showClosedAlert();

  if (closedSessionIds.length > 0) {
    return;
  }

  const paymentInput = document.querySelector('input[name="paymentMethod"]:checked');

  const cartItemIds = [];
  let i;
  for (i = 0; i < cart.items.length; i++) {
    cartItemIds.push(cart.items[i].id);
  }

  const button = document.querySelector('#confirm-button');
  setLoading(button, true);

  try {
    const result = await request('/bookings', {
      method: 'POST',
      body: {
        cartItemIds: cartItemIds,
        paymentMethod: paymentInput.value,
        promoCode: appliedPromo === null ? null : appliedPromo.code
      }
    });

    location.href = 'bookings.html?created=' + result.bookings.length;
  } catch (error) {
    handleSubmitError(error);
  } finally {
    setLoading(button, false);
  }
}


async function handleSubmitError(error) {
  const alertBox = document.querySelector('#checkout-alert');

  // 座位保留过期：提示 + 重新拉购物车
  if (error.code === 'HOLD_EXPIRED') {
    showAlert(alertBox, error.detail, 'danger');
    await reloadCart();
    return;
  }

  // 某个场次关闭了：服务端会告诉我们哪些场次
  if (error.code === 'BOOKING_CLOSED') {
    if (error.affectedIds !== null) {
      let i;
      for (i = 0; i < error.affectedIds.length; i++) {
        if (closedSessionIds.indexOf(error.affectedIds[i]) === -1) {
          closedSessionIds.push(error.affectedIds[i]);
        }
      }
    }
    drawGroups();
    drawConfirmState();
    showClosedAlert();
    return;
  }

  // 优惠码相关：显示在优惠码下面
  if (error.code === 'PROMO_NOT_FOUND' || error.code === 'PROMO_EXPIRED' ||
      error.code === 'PROMO_MIN_TICKETS') {
    showPromoFailure(error.detail, document.querySelector('#promo-code'));
    return;
  }

  // 座位被别人买走
  if (error.code === 'SEAT_OCCUPIED') {
    showAlert(alertBox, error.detail, 'danger');
    return;
  }

  showApiError(error, alertBox);
}


async function reloadCart() {
  try {
    cart = await request('/cart');
  } catch (error) {
    showToast(error.detail, 'danger');
    return;
  }

  if (cart.items.length === 0) {
    location.href = 'cart.html';
    return;
  }

  checkSessions();
  drawGroups();
  drawSummary();
  drawConfirmState();
}
