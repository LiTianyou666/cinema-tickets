import { request, getRefreshToken, clearTokens, isLoggedIn, goToLoginPage } from './api.js';
import { formatTickets } from './format.js';
import { ICON_PATH } from './ui.js';

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
    return null;
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


// access control for pages that need a user
export function requireAuth() {
  if (isLoggedIn()) {
    return true;
  }

  goToLoginPage();
  return false;
}

export function redirectIfLoggedIn() {
  if (isLoggedIn()) {
    location.href = 'index.html';
    return true;
  }
  return false;
}


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
    }
  }

  clearTokens();
  location.href = 'index.html';
}


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
