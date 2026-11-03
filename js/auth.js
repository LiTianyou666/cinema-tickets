// js/auth.js —— 登录态、访问控制、页头、登出（规格书 5.1 / 5.2）
//
// 页头在 HTML 里写的是【游客版】；登录后由 initHeader() 换成"邮箱链接 + Log out"。
// 受限页面开头调用 requireAuth()；登录页、注册页调用 redirectIfLoggedIn()。

import { request, getRefreshToken, clearTokens, isLoggedIn, goToLoginPage } from './api.js';
import { formatTickets } from './format.js';
import { ICON_PATH } from './ui.js';

// 允许作为 returnUrl 的站内页面（规格书 5.2.2：只接受站内相对地址）
const ALLOWED_PAGES = [
  'index.html',
  'movie.html',
  'session.html',
  'cart.html',
  'purchase.html',
  'bookings.html',
  'booking.html',
  'profile.html'
];


// ---------------------------------------------------------------------------
// 页头
// ---------------------------------------------------------------------------

// 已登录 → 换成邮箱链接 + Log out 按钮，并更新购物车计数
// 游客 → 什么都不做（HTML 里已经是游客版）
// 返回拿到的 profile（页面可以复用，省一次请求）；游客或失败返回 null
export async function initHeader() {
  if (isLoggedIn() === false) {
    return null;
  }

  const userArea = document.querySelector('.c-header__user');
  if (userArea === null) {
    return null;
  }

  let profile;
  try {
    profile = await request('/account/profile');
  } catch (error) {
    return null; // 拿不到资料就保持游客版，别打断页面
  }

  userArea.textContent = '';

  const emailLink = document.createElement('a');
  emailLink.className = 'c-header__email';
  emailLink.href = 'profile.html';
  emailLink.innerHTML = '<svg class="c-icon c-icon--sm" aria-hidden="true">' +
    '<use href="' + ICON_PATH + '#icon-user"></use></svg>';
  emailLink.append(profile.email);

  const logoutButton = document.createElement('button');
  logoutButton.className = 'c-btn c-btn--ghost c-btn--sm';
  logoutButton.type = 'button';
  logoutButton.innerHTML = '<svg class="c-icon c-icon--sm" aria-hidden="true">' +
    '<use href="' + ICON_PATH + '#icon-logout"></use></svg>Log out';
  logoutButton.addEventListener('click', function () {
    logout();
  });

  userArea.appendChild(emailLink);
  userArea.appendChild(logoutButton);

  await updateCartCounter();
}

// 购物车计数器：游客和空车都要隐藏（规格书 5.1.3）
export async function updateCartCounter() {
  const counter = document.querySelector('.c-counter');
  if (counter === null) {
    return;
  }

  if (isLoggedIn() === false) {
    counter.hidden = true;
    return;
  }

  try {
    const cart = await request('/cart');

    if (cart.ticketsCount === 0) {
      counter.hidden = true;
      return;
    }

    counter.textContent = cart.ticketsCount;
    counter.hidden = false;
    counter.setAttribute('aria-label', formatTickets(cart.ticketsCount) + ' in the cart');
  } catch (error) {
    counter.hidden = true;
  }
}


// ---------------------------------------------------------------------------
// 访问控制
// ---------------------------------------------------------------------------

// 受限页面开头调用：没登录就跳登录页（带 returnUrl），返回 false
export function requireAuth() {
  if (isLoggedIn()) {
    return true;
  }

  goToLoginPage();
  return false;
}

// 登录页 / 注册页调用：已登录就直接回首页
export function redirectIfLoggedIn() {
  if (isLoggedIn()) {
    location.href = 'index.html';
    return true;
  }
  return false;
}


// ---------------------------------------------------------------------------
// 登出
// ---------------------------------------------------------------------------

export async function logout() {
  const refreshToken = getRefreshToken();

  if (refreshToken !== null) {
    try {
      await request('/account/logout', {
        method: 'POST',
        auth: false,
        body: { refreshToken: refreshToken }
      });
    } catch (error) {
      // 服务器出错也要在本地登出，别把用户卡在已登录状态
    }
  }

  clearTokens();
  location.href = 'index.html';
}


// ---------------------------------------------------------------------------
// 登录成功后跳哪里
// ---------------------------------------------------------------------------

// 只接受站内页面地址，其他一律回首页（防止被塞外部链接）
export function getReturnUrl() {
  const params = new URLSearchParams(location.search);
  const value = params.get('returnUrl');

  if (value === null) {
    return 'index.html';
  }

  for (const page of ALLOWED_PAGES) {
    if (value === page || value.indexOf(page + '?') === 0) {
      return value;
    }
  }

  return 'index.html';
}
