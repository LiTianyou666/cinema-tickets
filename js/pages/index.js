// js/pages/index.js —— 影片目录页 第 9 章
//
// 参考标记：S04a（默认）、S04b（筛选已应用）、S04c（加载中）、S04d（空结果）、S04e（游客第 3 页）
//
// 核心思路：页面状态全部存在地址栏
//   加载时：读地址栏参数 → 回填筛选控件 → 用同样的参数请求 /api/movies
//   分页：真正的 <a href> 链接，带着完整查询串，所以刷新、分享都能还原同一页

import { request } from '../api.js';
import { getConfig } from '../config.js';
import {
  setTimeZone, getTodayDateString,
  formatDuration, formatRating, formatGenre,
  formatWeekdayShortDate, formatShortDate, formatReviews, formatMovies
} from '../format.js';
import { initHeader } from '../auth.js';
import { setBusy, showAlert, clearAlerts, showApiError } from '../ui.js';

main();

async function main() {
  const config = await getConfig();
  setTimeZone(config.timeZone);

  // 页头（邮箱 / Log out / 购物车计数器）。不 await：让它在后台自己跑完
  initHeader();

  const grid = document.querySelector('#movie-grid');
  const emptyArea = document.querySelector('#empty-area');
  const paginationArea = document.querySelector('#pagination-area');
  const countLabel = document.querySelector('#catalog-count');
  const dateSelect = document.querySelector('#filter-date');
  const sortingSelect = document.querySelector('#filter-sorting');
  const nowShowingSwitch = document.querySelector('#filter-now-showing');
  const alertBox = document.querySelector('#page-alert');

  // 地址栏参数就是页面状态
  const params = new URLSearchParams(location.search);

  fillDateOptions(config.scheduleDaysAhead);
  fillControls();
  updateMultiselectLabels();

  // 勾选复选框时，同步更新Any / 2 个标签 / N selected这段文字
  document.addEventListener('change', function (event) {
    if (event.target.className === 'c-check__input') {
      updateMultiselectLabels();
    }
  });

  await loadMovies();


  // -------------------------------------------------------------------------
  // 1. 把地址栏参数回填到控件上
  // -------------------------------------------------------------------------

  function fillControls() {
    const selectedGenres = params.getAll('genres');
    for (const input of document.querySelectorAll('input[name="genres"]')) {
      input.checked = selectedGenres.indexOf(input.value) !== -1;
    }

    const selectedAges = params.getAll('ageRatings');
    for (const input of document.querySelectorAll('input[name="ageRatings"]')) {
      input.checked = selectedAges.indexOf(input.value) !== -1;
    }

    dateSelect.value = params.get('date') || '';
    sortingSelect.value = params.get('sorting') || 'TitleAsc';
    nowShowingSwitch.checked = params.get('nowShowing') === 'true';
  }


  // 日期下拉：从今天起 scheduleDaysAhead 天，第一个是 Today
  function fillDateOptions(daysAhead) {
    const today = new Date();

    for (let i = 0; i < daysAhead; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);

      const iso = toIsoDate(date);
      const option = document.createElement('option');
      option.value = iso;

      if (i === 0) {
        option.textContent = 'Today, ' + formatShortDate(iso);
      } else {
        option.textContent = formatWeekdayShortDate(iso);
      }
      dateSelect.appendChild(option);
    }
  }


  function toIsoDate(date) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return date.getFullYear() + '-' + month + '-' + day;
  }


  // 关闭状态的多选显示：Any / 最多两个标签 / N selected 9.1.4
  function updateMultiselectLabels() {
    for (const details of document.querySelectorAll('.c-multiselect')) {
      const checked = details.querySelectorAll('.c-check__input:checked');
      const valueSpan = details.querySelector('.c-multiselect__value');

      if (checked.length === 0) {
        valueSpan.textContent = 'Any';
      } else if (checked.length <= 2) {
        const texts = [];
        for (const input of checked) {
          texts.push(input.closest('label').querySelector('span:last-child').textContent);
        }
        valueSpan.textContent = texts.join(', ');
      } else {
        valueSpan.textContent = checked.length + ' selected';
      }
    }
  }


  // -------------------------------------------------------------------------
  // 2. 请求数据（先显示骨架卡）
  // -------------------------------------------------------------------------

  async function loadMovies() {
    clearAlerts(alertBox);
    showSkeletons();

    const query = new URLSearchParams();
    for (const genre of params.getAll('genres')) {
      query.append('genres', genre);
    }
    for (const age of params.getAll('ageRatings')) {
      query.append('ageRatings', age);
    }
    if (params.get('date')) {
      query.set('date', params.get('date'));
    }
    if (params.get('sorting')) {
      query.set('sorting', params.get('sorting'));
    }
    if (params.get('nowShowing') === 'true') {
      query.set('nowShowing', 'true');
    }
    query.set('page', params.get('page') || '1');

    try {
      const data = await request('/movies?' + query.toString());
      renderMovies(data);
    } catch (error) {
      grid.textContent = '';
      emptyArea.textContent = '';
      paginationArea.textContent = '';
      countLabel.textContent = '';
      handleLoadError(error);
    } finally {
      setBusy(grid, false);
    }
  }


  function showSkeletons() {
    setBusy(grid, true);
    grid.textContent = '';
    emptyArea.textContent = '';
    paginationArea.textContent = '';

    for (let i = 0; i < 8; i++) {
      const skeleton = document.createElement('div');
      skeleton.className = 'l-stack l-stack--sm';
      skeleton.setAttribute('aria-hidden', 'true');
      skeleton.innerHTML =
        '<span class="c-skeleton c-skeleton--poster"></span>' +
        '<span class="c-skeleton c-skeleton--title"></span>' +
        '<span class="c-skeleton c-skeleton--text"></span>';
      grid.appendChild(skeleton);
    }
  }


  // -------------------------------------------------------------------------
  // 3. 渲染
  // -------------------------------------------------------------------------

  function renderMovies(data) {
    countLabel.textContent = formatMovies(data.pagination.totalItems);

    grid.textContent = '';
    emptyArea.textContent = '';

    if (data.movies.length === 0) {
      emptyArea.appendChild(createEmptyState());
      paginationArea.textContent = '';
      return;
    }

    for (const movie of data.movies) {
      grid.appendChild(createCard(movie));
    }

    renderPagination(data.pagination);
  }


  function createCard(movie) {
    const card = document.createElement('article');
    card.className = 'c-movie-card';
    card.innerHTML =
      '<div class="c-movie-card__media">' +
        '<div class="c-poster c-poster--md"><img class="c-poster__img" alt="" width="400" height="600"></div>' +
      '</div>' +
      '<h2 class="c-movie-card__title"><a class="c-movie-card__link"></a></h2>' +
      '<p class="c-movie-card__meta"></p>' +
      '<div class="c-stars c-stars--sm"><span class="c-stars__icons" role="img"></span><span class="c-stars__value"></span><span class="c-stars__count"></span></div>';

    const poster = card.querySelector('.c-poster__img');
    poster.src = movie.posterUrl;

    // 上映日期晚于今天 → 加 Coming soon 徽章 9.2.2
    if (movie.releaseDate > getTodayDateString()) {
      const badge = document.createElement('span');
      badge.className = 'c-badge c-badge--info c-movie-card__badge';
      badge.textContent = 'Coming soon · ' + formatShortDate(movie.releaseDate);
      card.querySelector('.c-movie-card__media').appendChild(badge);
    }

    const link = card.querySelector('.c-movie-card__link');
    link.href = 'movie.html?id=' + movie.id;
    link.textContent = movie.title;

    card.querySelector('.c-movie-card__meta').textContent = buildMeta(movie);

    const stars = card.querySelector('.c-stars');

    if (movie.rating === null) {
      stars.innerHTML = '<span class="c-stars__none">No ratings yet</span>';
    } else {
      // --rating 是规格书允许的唯二行内自定义属性（另一个是 --seat-cols）
      stars.setAttribute('style', '--rating: ' + movie.rating);
      stars.querySelector('.c-stars__icons').setAttribute(
        'aria-label', 'Rating ' + formatRating(movie.rating) + ' out of 10'
      );
      stars.querySelector('.c-stars__value').textContent = formatRating(movie.rating);
      stars.querySelector('.c-stars__count').textContent = formatReviews(movie.reviewsCount);
    }

    return card;
  }


  // 'Family, Comedy · 1 h 32 min'
  function buildMeta(movie) {
    const genres = [];
    for (const genre of movie.genres) {
      genres.push(formatGenre(genre));
    }
    return genres.join(', ') + ' · ' + formatDuration(movie.durationMinutes);
  }


  function createEmptyState() {
    const empty = document.createElement('div');
    empty.className = 'c-empty';
    empty.innerHTML =
      '<div class="c-empty__icon"><svg class="c-icon c-icon--lg" aria-hidden="true"><use href="kit/icons.svg#icon-film"></use></svg></div>' +
      '<h2 class="c-empty__title">No movies match the filters</h2>' +
      '<div class="c-empty__action"><a class="c-btn c-btn--primary" href="index.html">Reset filters</a></div>';
    return empty;
  }


  // -------------------------------------------------------------------------
  // 4. 分页：真正的链接，带完整查询串 + page=N
  // -------------------------------------------------------------------------

  function renderPagination(pagination) {
    paginationArea.textContent = '';

    if (pagination.pageCount <= 1) {
      return; // 只有一页就不显示分页（规格书 9.2.3）
    }

    const nav = document.createElement('nav');
    nav.className = 'c-pagination';
    nav.setAttribute('aria-label', 'Pages');

    const current = pagination.currentPage;

    nav.appendChild(createPageLink({
      text: 'Previous', page: current - 1, disabled: current === 1, iconBefore: 'icon-chevron-left'
    }));

    for (let page = 1; page <= pagination.pageCount; page++) {
      nav.appendChild(createPageLink({
        text: String(page), page: page, current: page === current
      }));
    }

    nav.appendChild(createPageLink({
      text: 'Next', page: current + 1, disabled: current === pagination.pageCount, iconAfter: 'icon-chevron-right'
    }));

    paginationArea.appendChild(nav);
  }


  function createPageLink(options) {
    const link = document.createElement('a');
    link.className = 'c-pagination__link';

    if (options.iconBefore) {
      link.innerHTML = '<svg class="c-icon c-icon--sm" aria-hidden="true"><use href="kit/icons.svg#' +
        options.iconBefore + '"></use></svg>';
      link.append(options.text);
    } else if (options.iconAfter) {
      link.textContent = options.text;
      link.insertAdjacentHTML('beforeend',
        '<svg class="c-icon c-icon--sm" aria-hidden="true"><use href="kit/icons.svg#' +
        options.iconAfter + '"></use></svg>');
    } else {
      link.textContent = options.text;
    }

    if (options.disabled) {
      link.setAttribute('aria-disabled', 'true'); // 不可用时不加 href
    } else {
      link.href = buildPageUrl(options.page);
    }

    if (options.current) {
      link.setAttribute('aria-current', 'page');
    }

    return link;
  }


  function buildPageUrl(page) {
    const query = new URLSearchParams(params);
    query.set('page', page);
    return 'index.html?' + query.toString();
  }


  // -------------------------------------------------------------------------
  // 5. 错误处理
  // -------------------------------------------------------------------------

  function handleLoadError(error) {
    if (error.code === 'INVALID_PAGE' || error.code === 'INVALID_DATE' || error.code === 'VALIDATION_ERROR') {
      showAlert(alertBox, error.detail, 'danger', 'Back to the catalog', 'index.html');
      return;
    }
    showApiError(error, alertBox);
  }
}
