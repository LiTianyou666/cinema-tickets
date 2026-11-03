// js/api.js —— 所有网络请求的唯一入口
//
// 风格约定：代码（变量名、函数名、字符串）用简单英文，注释用中文
// 页面不写 fetch()，只调用这里的 request()

const BASE_URL = 'https://api.cinema.int.hardcoder.ru/api';

// localStorage 里存 token 用的键名，只在这里写一次
const ACCESS_KEY = 'cinema.accessToken';
const REFRESH_KEY = 'cinema.refreshToken';

// 服务器连不上 / 5xx 时给用户看的文案
const SERVER_DOWN_TEXT = 'The server is unavailable. Try again later.';


// ---------------------------------------------------------------------------
// 1. token 的读写
// ---------------------------------------------------------------------------

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

// 登录 / 注册 / 刷新成功后，服务端返回 { accessToken, refreshToken, ... }
export function saveTokens(data) {
  localStorage.setItem(ACCESS_KEY, data.accessToken);
  localStorage.setItem(REFRESH_KEY, data.refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

// 有 refresh token 就算登录过
export function isLoggedIn() {
  return getRefreshToken() !== null;
}


// ---------------------------------------------------------------------------
// 2. 错误对象
//
// 服务端出错时返回 ProblemDetails：{ status, code, detail, errors, affectedIds }
// 统一包成一个 Error，页面 catch 之后看 err.code 决定怎么显示
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(status, problem) {
    // problem 可能是 undefined（比如连不上服务器，是我们自己造的）
    const data = problem || {};
    super(data.detail || 'Request failed');

    this.name = 'ApiError';
    this.status = status;          // HTTP 状态码，0 表示没连上服务器
    this.code = data.code || null; // 例如 'SEAT_OCCUPIED'
    this.detail = data.detail || 'Request failed'; // 给用户看的文案
    this.errors = data.errors || null;             // 校验错误：字段名 → 消息数组
    this.affectedIds = data.affectedIds || null;   // 例如 BOOKING_CLOSED 的场次 id
  }
}


// ---------------------------------------------------------------------------
// 3. 刷新 token
// ---------------------------------------------------------------------------

// 真正发刷新请求。故意用 fetch 而不用 request()：
// 否则刷新自己收到 401 又会触发刷新，无限循环
async function sendRefreshRequest() {
  const refreshToken = getRefreshToken();
  if (refreshToken === null) {
    return false; // 游客，没什么可刷的
  }

  let response;
  try {
    response = await fetch(BASE_URL + '/account/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refreshToken })
    });
  } catch (error) {
    // 网络断了：不当成刷新失败，让上层按服务器不可用处理
    throw new ApiError(0, { code: 'SERVER_UNAVAILABLE', detail: SERVER_DOWN_TEXT });
  }

  if (!response.ok) {
    return false; // refresh token 无效 / 过期 / 已经用过
  }

  saveTokens(await response.json());
  return true;
}

// refresh token 只能用一次，所以同一时刻只能有一个刷新请求
// refreshPromise 记住正在进行的那次刷新：第一个 401 发起，后面的 401 直接等它
let refreshPromise = null;

function refreshOnce() {
  if (refreshPromise === null) {
    refreshPromise = sendRefreshRequest().finally(function () {
      refreshPromise = null; // 不管成功失败，结束就清空，下次还能再刷
    });
  }
  return refreshPromise;
}

// 刷新失败（token 无效）→ 清掉 token，跳登录页并记住当前地址 4.2.5
// auth.js 的 requireAuth() 也复用它，所以 export
export function goToLoginPage() {
  const fileName = location.pathname.split('/').pop();
  const returnUrl = fileName + location.search;
  location.href = 'login.html?returnUrl=' + encodeURIComponent(returnUrl);
}


// ---------------------------------------------------------------------------
// 4. 请求入口
//
// options:
//   method   'GET' | 'POST' | 'PUT' | 'DELETE'，默认 'GET'
//   body     要发送的对象；GET 和 DELETE 不用传
//   auth     默认带 token；登录、注册、/config 传 false
//   retried  内部用：标记这是刷新之后的重放，防止 401 死循环
// ---------------------------------------------------------------------------

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

  // access token 过期 → 刷新一次，然后把原请求重发一次（只重发一次）
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

  // 5xx：服务器自己的问题
  if (response.status >= 500) {
    throw new ApiError(response.status, { code: 'SERVER_UNAVAILABLE', detail: SERVER_DOWN_TEXT });
  }

  // 读响应体。DELETE 返回 204 没有 body，所以要容错，不能直接 response.json()
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
    throw new ApiError(response.status, data); // data 就是 ProblemDetails
  }

  return data;
}
