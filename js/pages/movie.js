// js/pages/movie.js —— 影片详情页 10.1 / 10.2 / 10.3
//
// 参考标记：S05a（今天有场次）、S05b（自己的影评）、S05g（未上映）、S05f（游客）
//
// 地址：movie.html?id={movieId}&date={date}
// 分工：
//   10.1 详情块   ← GET /api/movies/{id}
//   10.2 场次     ← 日期标签 + GET /api/movies/{id}/sessions?date=
//   10.3 影评     ← GET /api/movies/{id}/reviews?page=

import { request, isLoggedIn } from '../api.js';
import { getConfig } from '../config.js';
import {
  setTimeZone, getTodayDateString,
  formatDate, formatDuration, formatAgeRating, formatFormat, formatGenre,
  formatRating, formatReviews, formatTime, formatWeekdayShortDate, formatShortDate,
  formatMoney
} from '../format.js';
import { initHeader } from '../auth.js';
import {
  setBusy, showAlert, clearAlerts, showApiError,
  setLoading, setFieldError, clearFieldError, showToast
} from '../ui.js';

// 场次分组顺序
const FORMAT_ORDER = ['Imax', 'ThreeD', 'TwoD'];

main();

async function main() {
  const config = await getConfig();
  setTimeZone(config.timeZone);
  initHeader();

  const params = new URLSearchParams(location.search);
  const movieId = params.get('id');

  const content = document.querySelector('#movie-content');

  if (!movieId) {
    content.textContent = '';
    content.appendChild(createNotFound());
    return;
  }

  let movie;
  try {
    movie = await request('/movies/' + encodeURIComponent(movieId));
  } catch (error) {
    content.textContent = '';
    content.appendChild(createNotFound());
    return;
  }

  renderDetails(movie);
  setupDeleteDialog();
  await renderScheduleArea(movie, config, params);
  await renderOwnReviewArea(movie);
  await loadFirstPageOfReviews(movie);
}


// ---------------------------------------------------------------------------
// 10.1 详情块
// ---------------------------------------------------------------------------

function renderDetails(movie) {
  document.querySelector('#movie-poster').src = movie.posterUrl;
  document.querySelector('#movie-title').textContent = movie.title;
  document.querySelector('#movie-description').textContent = movie.description;
  document.querySelector('#movie-director').textContent = movie.director;
  document.querySelector('#movie-cast').textContent = movie.cast.join(', ');
  document.querySelector('#movie-country').textContent = movie.country;
  document.querySelector('#movie-duration').textContent = formatDuration(movie.durationMinutes);
  document.querySelector('#movie-release').textContent = formatDate(movie.releaseDate);

  // 年龄分级 + 类型徽章
  const badges = document.querySelector('#movie-badges');
  badges.textContent = '';

  const age = document.createElement('span');
  age.className = 'c-age';
  age.textContent = formatAgeRating(movie.ageRating);
  badges.appendChild(age);

  for (const genre of movie.genres) {
    const badge = document.createElement('span');
    badge.className = 'c-badge c-badge--neutral';
    badge.textContent = formatGenre(genre);
    badges.appendChild(badge);
  }

  // 评分（c-stars--lg）
  const stars = document.querySelector('#movie-stars');

  if (movie.rating === null) {
    stars.innerHTML = '<span class="c-stars__none">No ratings yet</span>';
  } else {
    stars.setAttribute('style', '--rating: ' + movie.rating);
    stars.querySelector('.c-stars__icons').setAttribute(
      'aria-label', 'Rating ' + formatRating(movie.rating) + ' out of 10'
    );
    stars.querySelector('.c-stars__value').textContent = formatRating(movie.rating);
    stars.querySelector('.c-stars__count').textContent = formatReviews(movie.reviewsCount);
  }
}


// ---------------------------------------------------------------------------
// 10.2 场次
// ---------------------------------------------------------------------------

async function renderScheduleArea(movie, config, params) {
  const tabs = document.querySelector('#date-tabs');
  const scheduleArea = document.querySelector('#schedule-area');
  const scheduleAlert = document.querySelector('#schedule-alert');

  // 未上映：用 alert 替代整个场次区 10.2.4
  if (movie.releaseDate > getTodayDateString()) {
    tabs.textContent = '';
    scheduleArea.textContent = '';
    showAlert(scheduleAlert, 'Sessions will be available from ' + formatDate(movie.releaseDate) + '.', 'info');
    return;
  }

  // 选中日期：地址里的 date，没有就用第一个有场次的日期。
  const sessionDates = movie.sessionDates || [];
  let selectedDate = params.get('date');

  if (!selectedDate || sessionDates.indexOf(selectedDate) === -1) {
    selectedDate = sessionDates.length > 0 ? sessionDates[0] : toIsoDate(new Date());
  }

  renderDateTabs(tabs, selectedDate, sessionDates, config.scheduleDaysAhead, movie.id);

  // 请求这一天的场次
  setBusy(scheduleArea, true);

  let sessions = [];
  try {
    sessions = await request('/movies/' + encodeURIComponent(movie.id) + '/sessions?date=' + selectedDate);
  } catch (error) {
    showApiError(error, scheduleAlert);
  } finally {
    setBusy(scheduleArea, false);
  }

  renderSessions(scheduleArea, sessions, config.scheduleDaysAhead);
}


// 日期标签：scheduleDaysAhead 天，第一个是 Today
function renderDateTabs(tabs, selectedDate, sessionDates, daysAhead, movieId) {
  tabs.textContent = '';

  const today = new Date();

  for (let i = 0; i < daysAhead; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);

    const iso = toIsoDate(date);
    const label = formatWeekdayShortDate(iso).split(', '); // ['Tue', '6 Oct']

    const tab = document.createElement('a');
    tab.className = 'c-date-tabs__tab';

    const daySpan = document.createElement('span');
    daySpan.className = 'c-date-tabs__day';
    daySpan.textContent = i === 0 ? 'Today' : label[0];

    const dateSpan = document.createElement('span');
    dateSpan.className = 'c-date-tabs__date';
    dateSpan.textContent = label[1];

    tab.appendChild(daySpan);
    tab.appendChild(dateSpan);

    if (iso === selectedDate) {
      tab.setAttribute('aria-current', 'date');
    }

    // 这一天没有场次 → 不给链接，只标 aria-disabled 10.2.1
    if (sessionDates.indexOf(iso) === -1) {
      tab.setAttribute('aria-disabled', 'true');
    } else {
      tab.href = 'movie.html?id=' + movieId + '&date=' + iso;
    }

    tabs.appendChild(tab);
  }
}


// 场次：按 IMAX → 3D → 2D 分组，每组一个 c-session-group
function renderSessions(container, sessions, daysAhead) {
  container.textContent = '';

  if (sessions.length === 0) {
    container.appendChild(createEmpty(
      'There are no sessions in the next ' + daysAhead + ' days.'
    ));
    return;
  }

  for (const format of FORMAT_ORDER) {
    const list = [];

    for (const session of sessions) {
      if (session.format === format) {
        list.push(session);
      }
    }

    if (list.length === 0) {
      continue;
    }

    const group = document.createElement('section');
    group.className = 'c-session-group';

    // 组头：格式 + 影厅名（去重后用逗号连接）
    const halls = [];
    for (const session of list) {
      if (halls.indexOf(session.hall.name) === -1) {
        halls.push(session.hall.name);
      }
    }

    const header = document.createElement('header');
    header.className = 'c-session-group__header';
    header.innerHTML =
      '<span class="c-format"></span><span class="c-session-group__halls"></span>';
    header.querySelector('.c-format').textContent = formatFormat(format);
    header.querySelector('.c-session-group__halls').textContent = halls.join(', ');

    const listBox = document.createElement('div');
    listBox.className = 'c-session-group__list';

    for (const session of list) {
      listBox.appendChild(createSessionTile(session));
    }

    group.appendChild(header);
    group.appendChild(listBox);
    container.appendChild(group);
  }
}


// 一个场次牌：时间 + 影厅 + 起价；已停止售票则无链接
function createSessionTile(session) {
  const tile = document.createElement('a');
  tile.className = 'c-session';

  tile.innerHTML =
    '<span class="c-session__time"></span>' +
    '<span class="c-session__hall"></span>' +
    '<span class="c-session__price"></span>';

  tile.querySelector('.c-session__time').textContent = formatTime(session.startsAt);
  tile.querySelector('.c-session__hall').textContent = session.hall.name;

  if (session.isBookingOpen) {
    tile.href = 'session.html?id=' + session.id;
    tile.querySelector('.c-session__price').textContent = 'from ' + formatMoney(session.prices.standard);
  } else {
    tile.setAttribute('aria-disabled', 'true');
    tile.querySelector('.c-session__price').textContent = 'Booking closed';
  }

  return tile;
}


// ---------------------------------------------------------------------------
// 10.3 影评：列表 + 追加。
// ---------------------------------------------------------------------------

async function loadFirstPageOfReviews(movie) {
  document.querySelector('#reviews-count').textContent = movie.reviewsCount;
  await loadReviews(movie, 1, false);
}


async function loadReviews(movie, page, append) {
  const list = document.querySelector('#review-list');
  const moreArea = document.querySelector('#load-more-area');

  let data;
  try {
    data = await request('/movies/' + encodeURIComponent(movie.id) + '/reviews?page=' + page);
  } catch (error) {
    showApiError(error, null);
    return;
  }

  if (append === false) {
    list.textContent = '';
  }

  for (const review of data.reviews) {
    if (review.isMine) {
      continue; // 自己的影评在上方单独显示，不在列表里重复（规格书 10.3.2）
    }
    list.appendChild(createReview(review));
  }

  moreArea.textContent = '';

  // 还有下一页 → 放Show more reviews
  if (data.pagination.currentPage < data.pagination.pageCount) {
    const button = document.createElement('button');
    button.className = 'c-btn c-btn--secondary';
    button.type = 'button';
    button.textContent = 'Show more reviews';
    button.addEventListener('click', function () {
      button.remove();
      loadReviews(movie, page + 1, true);
    });
    moreArea.appendChild(button);
  }
}


function createReview(review) {
  const article = document.createElement('article');
  article.className = 'c-review';

  article.innerHTML =
    '<header class="c-review__header">' +
      '<span class="c-review__author"></span>' +
      '<span class="c-badge c-badge--neutral"></span>' +
      '<time class="c-review__date"></time>' +
    '</header>' +
    '<p class="c-review__text"></p>';

  article.querySelector('.c-review__author').textContent = review.authorName;
  article.querySelector('.c-badge').textContent = formatRating(review.rating) + ' / 10';
  article.querySelector('.c-review__date').textContent = formatDate(review.createdAt);
  article.querySelector('.c-review__text').textContent = review.text;

  return article;
}


// ---------------------------------------------------------------------------
// 10.3 自己的影评区：游客提示 / 不能评 / 表单 / 已评（可编辑、可删除）
// ---------------------------------------------------------------------------

async function renderOwnReviewArea(movie) {
  const area = document.querySelector('#own-review-area');
  area.textContent = '';

  // 游客：提示登录 10.3.4
  if (isLoggedIn() === false) {
    showAlert(area, 'Log in to leave a review.', 'info', 'Log in',
      'login.html?returnUrl=' + encodeURIComponent('movie.html?id=' + movie.id));
    return;
  }

  let check;
  try {
    check = await request('/movies/' + encodeURIComponent(movie.id) + '/reviews/check');
  } catch (error) {
    showApiError(error, null);
    return;
  }

  if (check.eligibility === 'NotAttended') {
    showAlert(area, 'You can review this movie after attending one of its sessions.', 'info');
    return;
  }

  if (check.eligibility === 'AlreadyReviewed') {
    area.appendChild(createMyReview(check.myReview, movie));
    return;
  }

  area.appendChild(createReviewForm(movie, null)); // Allowed
}


// 影评表单（新建或编辑）
function createReviewForm(movie, existingReview) {
  const isEdit = existingReview !== null;

  const form = document.createElement('form');
  form.className = 'c-review-form';
  form.innerHTML =
    '<h3 class="c-review-form__title">Your review</h3>' +
    '<fieldset class="c-stars-input">' +
      '<legend class="c-stars-input__legend">Your rating</legend>' +
      '<div class="c-stars-input__row">' +
        '<div class="c-stars-input__stars"></div>' +
        '<output class="c-stars-input__value">— / 10</output>' +
      '</div>' +
    '</fieldset>' +
    '<div class="c-field">' +
      '<label class="c-field__label" for="review-text">Review text</label>' +
      '<textarea class="c-textarea" id="review-text" name="text" rows="5" maxlength="1000"></textarea>' +
      '<div class="c-review-form__meta"><span class="c-review-form__counter">0 / 1000</span></div>' +
      '<p class="c-field__error" id="review-text-error" hidden>' +
        '<svg class="c-icon c-icon--sm" aria-hidden="true"><use href="kit/icons.svg#icon-error"></use></svg><span></span>' +
      '</p>' +
    '</div>' +
    '<div class="c-review-form__actions">' +
      '<button class="c-btn c-btn--primary" type="submit" id="review-submit">Publish review</button>' +
    '</div>';

  // 1..10 十颗星，每颗是一个 radio
  const starsBox = form.querySelector('.c-stars-input__stars');
  for (let value = 1; value <= 10; value++) {
    const label = document.createElement('label');
    label.className = 'c-stars-input__star';
    label.innerHTML =
      '<input class="c-stars-input__radio" type="radio" name="rating" value="' + value + '">' +
      '<span class="u-visually-hidden">' + value + ' of 10</span>';
    starsBox.appendChild(label);
  }

  const ratingOutput = form.querySelector('.c-stars-input__value');
  const textarea = form.querySelector('#review-text');
  const counter = form.querySelector('.c-review-form__counter');
  const submitButton = form.querySelector('#review-submit');

  // 选星 → 更新 8 / 10
  form.addEventListener('change', function (event) {
    if (event.target.className === 'c-stars-input__radio') {
      ratingOutput.textContent = event.target.value + ' / 10';
    }
  });

  // 输入文字 → 更新计数器。
  textarea.addEventListener('input', function () {
    counter.textContent = textarea.value.length + ' / 1000';
  });

  // 编辑模式：预填 + 加一个 Cancel 按钮
  if (isEdit) {
    submitButton.textContent = 'Save';

    for (const radio of form.querySelectorAll('.c-stars-input__radio')) {
      if (Number(radio.value) === existingReview.rating) {
        radio.checked = true;
      }
    }
    ratingOutput.textContent = existingReview.rating + ' / 10';
    textarea.value = existingReview.text;
    counter.textContent = existingReview.text.length + ' / 1000';

    const cancelButton = document.createElement('button');
    cancelButton.className = 'c-btn c-btn--ghost';
    cancelButton.type = 'button';
    cancelButton.textContent = 'Cancel';
    cancelButton.addEventListener('click', function () {
      renderOwnReviewArea(movie);
    });
    form.querySelector('.c-review-form__actions').appendChild(cancelButton);
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    submitReview(movie, form, existingReview);
  });

  return form;
}


// 提交：新建用 POST，编辑用 PUT
async function submitReview(movie, form, existingReview) {
  const textarea = form.querySelector('#review-text');
  const textError = form.querySelector('#review-text-error');
  const submitButton = form.querySelector('#review-submit');
  const checked = form.querySelector('.c-stars-input__radio:checked');

  const rating = checked === null ? 0 : Number(checked.value);
  const text = textarea.value.trim();

  clearFieldError(textarea, textError);

  // 浏览器先校验（规则和文案来自5.4）
  if (text.length < 10 || text.length > 1000) {
    setFieldError(textarea, textError, 'The review text must be 10 to 1000 characters long.');
    return;
  }
  if (rating < 1 || rating > 10) {
    showToast('The rating must be an integer from 1 to 10.', 'danger');
    return;
  }

  setLoading(submitButton, true);

  try {
    if (existingReview === null) {
      await request('/movies/' + encodeURIComponent(movie.id) + '/reviews', {
        method: 'POST',
        body: { rating: rating, text: text }
      });
    } else {
      await request('/reviews/' + encodeURIComponent(existingReview.id), {
        method: 'PUT',
        body: { rating: rating, text: text }
      });
    }

    const fresh = await refreshMovie(movie);
    await renderOwnReviewArea(fresh);
  } catch (error) {
    if (error.code === 'VALIDATION_ERROR') {
      const message = error.errors && error.errors.text ? error.errors.text[0] : error.detail;
      setFieldError(textarea, textError, message);
    } else {
      showToast(error.detail, 'danger');
    }
  } finally {
    setLoading(submitButton, false);
  }
}


// 自己的影评（AlreadyReviewed 状态），带 Edit / Delete
function createMyReview(review, movie) {
  const article = document.createElement('article');
  article.className = 'c-review c-review--mine';

  article.innerHTML =
    '<header class="c-review__header">' +
      '<span class="c-review__author"></span>' +
      '<span class="c-badge c-badge--neutral"></span>' +
      '<time class="c-review__date"></time>' +
    '</header>' +
    '<p class="c-review__text"></p>' +
    '<div class="c-review__actions">' +
      '<button class="c-btn c-btn--secondary c-btn--sm" type="button" id="edit-review">Edit</button>' +
      '<button class="c-btn c-btn--secondary c-btn--sm c-btn--danger" type="button" id="delete-review">Delete</button>' +
    '</div>';

  article.querySelector('.c-review__author').textContent = review.authorName;
  article.querySelector('.c-badge').textContent = formatRating(review.rating) + ' / 10';
  article.querySelector('.c-review__date').textContent =
    formatDate(review.updatedAt || review.createdAt);
  article.querySelector('.c-review__text').textContent = review.text;

  article.querySelector('#edit-review').addEventListener('click', function () {
    const area = document.querySelector('#own-review-area');
    area.textContent = '';
    area.appendChild(createReviewForm(movie, review));
  });

  article.querySelector('#delete-review').addEventListener('click', function () {
    openDeleteDialog(review, movie);
  });

  return article;
}


// 删除确认对话框 10.3.7
let pendingDelete = null;

function setupDeleteDialog() {
  const dialog = document.querySelector('#delete-review-dialog');
  if (dialog === null) {
    return;
  }

  dialog.querySelector('#keep-review').addEventListener('click', function () {
    dialog.close();
  });

  dialog.querySelector('#confirm-delete-review').addEventListener('click', async function () {
    if (pendingDelete === null) {
      return;
    }

    const target = pendingDelete;
    pendingDelete = null;
    dialog.close();

    try {
      await request('/reviews/' + encodeURIComponent(target.review.id), { method: 'DELETE' });
      const fresh = await refreshMovie(target.movie);
      await renderOwnReviewArea(fresh); // 删除后回到表单（规格书 10.3.7）
    } catch (error) {
      showToast(error.detail, 'danger');
    }
  });
}

function openDeleteDialog(review, movie) {
  pendingDelete = { review: review, movie: movie };

  const dialog = document.querySelector('#delete-review-dialog');
  if (dialog !== null) {
    dialog.showModal();
  }
}


// 影评变动后：重新拉影片（评分和数量会变）+ 重新渲染详情和列表。
async function refreshMovie(movie) {
  const fresh = await request('/movies/' + encodeURIComponent(movie.id));

  renderDetails(fresh);
  document.querySelector('#reviews-count').textContent = fresh.reviewsCount;
  await loadReviews(fresh, 1, false);

  return fresh;
}


// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------

function createNotFound() {
  const box = document.createElement('div');
  box.className = 'c-empty c-empty--error';
  box.innerHTML =
    '<div class="c-empty__icon"><svg class="c-icon c-icon--lg" aria-hidden="true"><use href="kit/icons.svg#icon-error"></use></svg></div>' +
    '<h2 class="c-empty__title">The movie was not found.</h2>' +
    '<div class="c-empty__action"><a class="c-btn c-btn--primary" href="index.html">Browse movies</a></div>';
  return box;
}


function createEmpty(text) {
  const box = document.createElement('div');
  box.className = 'c-empty';
  box.innerHTML =
    '<div class="c-empty__icon"><svg class="c-icon c-icon--lg" aria-hidden="true"><use href="kit/icons.svg#icon-calendar"></use></svg></div>' +
    '<h2 class="c-empty__title"></h2>';
  box.querySelector('.c-empty__title').textContent = text;
  return box;
}


function toIsoDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return date.getFullYear() + '-' + month + '-' + day;
}
