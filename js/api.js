// api base address, used by every request
const BASE_URL = 'https://api.cinema.int.hardcoder.ru/api';

const ACCESS_KEY = 'cinema.accessToken';
const REFRESH_KEY = 'cinema.refreshToken';

const SERVER_DOWN_TEXT = 'The server is unavailable. Try again later.';


export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

export function saveTokens(data) {
  localStorage.setItem(ACCESS_KEY, data.accessToken);
  localStorage.setItem(REFRESH_KEY, data.refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function isLoggedIn() {
  return getRefreshToken() !== null;
}



export class ApiError extends Error {
  constructor(status, problem) {
    const data = problem || {};
    super(data.detail || 'Request failed');

    this.name = 'ApiError';
    this.status = status;
    this.code = data.code || null;
    this.detail = data.detail || 'Request failed';
    this.errors = data.errors || null;
    this.affectedIds = data.affectedIds || null;
  }
}


async function sendRefreshRequest() {
  const refreshToken = getRefreshToken();
  if (refreshToken === null) {
    return false;
  }

  let response;
  try {
    response = await fetch(BASE_URL + '/account/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refreshToken })
    });
  } catch (error) {
    throw new ApiError(0, { code: 'SERVER_UNAVAILABLE', detail: SERVER_DOWN_TEXT });
  }

  if (!response.ok) {
    return false;
  }

  saveTokens(await response.json());
  return true;
}

// one refresh at a time, a refresh token can be used only once
let refreshPromise = null;

function refreshOnce() {
  if (refreshPromise === null) {
    refreshPromise = sendRefreshRequest().finally(function () {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export function goToLoginPage() {
  const fileName = location.pathname.split('/').pop();
  const returnUrl = fileName + location.search;
  location.href = 'login.html?returnUrl=' + encodeURIComponent(returnUrl);
}



// the only entry point for http requests
export async function request(path, options) {
  const opts = options || {};
  const method = opts.method || 'GET';

  const headers = { 'Accept': 'application/json' };
  if (opts.body) {
    headers['Content-Type'] = 'application/json';
  }
  if (opts.auth !== false) {
    const token = getAccessToken();
    if (token !== null) {
      headers['Authorization'] = 'Bearer ' + token;
    }
  }

  let response;
  try {
    response = await fetch(BASE_URL + path, {
      method: method,
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
  } catch (error) {
    throw new ApiError(0, { code: 'SERVER_UNAVAILABLE', detail: SERVER_DOWN_TEXT });
  }

  // token expired, refresh once and repeat the request
  if (response.status === 401 && opts.auth !== false && opts.retried !== true) {
    const refreshed = await refreshOnce();

    if (refreshed === false) {
      clearTokens();
      goToLoginPage();
      throw new ApiError(401, { code: 'UNAUTHORIZED', detail: 'Please log in again.' });
    }

    const retryOptions = { method: method, body: opts.body, retried: true };
    return request(path, retryOptions);
  }

  if (response.status >= 500) {
    throw new ApiError(response.status, { code: 'SERVER_UNAVAILABLE', detail: SERVER_DOWN_TEXT });
  }

  let data = null;
  const text = await response.text();
  if (text !== '') {
    try {
      data = JSON.parse(text);
    } catch (error) {
      data = null;
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, data);
  }

  return data;
}
