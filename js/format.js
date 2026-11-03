// js/format.js —— 显示格式化
//
// 用法：
//   页面启动时：const config = await getConfig(); setTimeZone(config.timeZone);
//   之后就可以直接调用 formatMoney(1550) 这样的函数
//
// 两个要点：
//   1. 所有日期时间都按【影院时区】显示，与电脑时区无关 → Intl 必须传 timeZone
//   2. 不让 Intl 直接输出整串（不同地区格式会变），而是用 formatToParts() 取零件自己拼

// 影院时区。页面启动时用 config.timeZone 覆盖
// 默认给 UTC（中性值）：万一忘了设置，时间会明显不对，一眼能看出来
let timeZone = 'UTC';

export function setTimeZone(value) {
  timeZone = value;
}

// 把 ISO 时间按影院时区拆成零件：
// { weekday: 'Mon', day: '5', month: 'Oct', year: '2026', hour: '19', minute: '30' }
function getParts(isoString) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23' // 24 小时制，0 点显示 00 而不是 24
  });

  const parts = {};
  for (const part of formatter.formatToParts(new Date(isoString))) {
    parts[part.type] = part.value;
  }
  return parts;
}


// ---------------------------------------------------------------------------
// 金额
// ---------------------------------------------------------------------------

const moneyFormatter = new Intl.NumberFormat('en-US'); // 1550 -> '1,550'

export function formatMoney(amount) {
  return moneyFormatter.format(amount) + ' ₽';
}

export function formatDiscount(amount) {
  return '−' + formatMoney(amount); // 注意：这里是减号 −（U+2212），不是连字符 -
}


// ---------------------------------------------------------------------------
// 日期与时间
// ---------------------------------------------------------------------------

// 'Mon, 5 Oct · 19:30'
export function formatSessionDateTime(isoString) {
  const p = getParts(isoString);
  return p.weekday + ', ' + p.day + ' ' + p.month + ' · ' + p.hour + ':' + p.minute;
}

// '19:30–21:37'
export function formatTimeRange(startIsoString, endIsoString) {
  const start = getParts(startIsoString);
  const end = getParts(endIsoString);
  return start.hour + ':' + start.minute + '–' + end.hour + ':' + end.minute;
}

// '27 Sep 2026'
export function formatDate(isoString) {
  const p = getParts(isoString);
  return p.day + ' ' + p.month + ' ' + p.year;
}

// '5 Oct 2026, 17:12'
export function formatDateTime(isoString) {
  const p = getParts(isoString);
  return p.day + ' ' + p.month + ' ' + p.year + ', ' + p.hour + ':' + p.minute;
}

// '17:53'
export function formatTime(isoString) {
  const p = getParts(isoString);
  return p.hour + ':' + p.minute;
}

// 倒计时：751 秒 -> '12:31'
export function formatCountdown(totalSeconds) {
  const seconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return String(minutes).padStart(2, '0') + ':' + String(rest).padStart(2, '0');
}


// ---------------------------------------------------------------------------
// 时长、评分、座位、票数
// ---------------------------------------------------------------------------

// 127 -> '2 h 7 min'
export function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (hours === 0) {
    return rest + ' min';
  }
  if (rest === 0) {
    return hours + ' h';
  }
  return hours + ' h ' + rest + ' min';
}

// 8.23 -> '8.23'（无评分时 API 给 null，交给页面显示 'No ratings yet'）
export function formatRating(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return value.toFixed(2);
}

// (10, 9) -> 'Row 10, Seat 9'
export function formatSeat(row, number) {
  return 'Row ' + row + ', Seat ' + number;
}

// 今天的日期，YYYY-MM-DD（电脑本地时间，用于校验生日不能晚于今天）
export function getTodayDateString() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return now.getFullYear() + '-' + month + '-' + day;
}

// 1 -> '1 ticket'，5 -> '5 tickets'
export function formatTickets(count) {
  if (count === 1) {
    return '1 ticket';
  }
  return count + ' tickets';
}

// '2026-10-06' -> 'Tue, 6 Oct'（日期标签、下拉选项用）
export function formatWeekdayShortDate(isoString) {
  const p = getParts(isoString);
  return p.weekday + ', ' + p.day + ' ' + p.month;
}

// '2026-10-26' -> '26 Oct'（Coming soon · 徽章用，和 mockup 一致，不带年）
export function formatShortDate(isoString) {
  const p = getParts(isoString);
  return p.day + ' ' + p.month;
}

// 9 -> '9 reviews'，1 -> '1 review'
export function formatReviews(count) {
  if (count === 1) {
    return '1 review';
  }
  return count + ' reviews';
}

// 32 -> '32 movies'，1 -> '1 movie'
export function formatMovies(count) {
  if (count === 1) {
    return '1 movie';
  }
  return count + ' movies';
}


// ---------------------------------------------------------------------------
// 枚举的显示值 附录 A.4
// 写法：查表，查不到就原样返回（服务端以后新增枚举值也不会显示成空白）
// ---------------------------------------------------------------------------

const AGE_RATING_TEXT = { Age0: '0+', Age6: '6+', Age12: '12+', Age16: '16+', Age18: '18+' };

export function formatAgeRating(value) {
  return AGE_RATING_TEXT[value] || value;
}

const SESSION_FORMAT_TEXT = { TwoD: '2D', ThreeD: '3D', Imax: 'IMAX' };

export function formatFormat(value) {
  return SESSION_FORMAT_TEXT[value] || value;
}

const SEAT_TYPE_TEXT = { Standard: 'Standard', Vip: 'VIP' };

export function formatSeatType(value) {
  return SEAT_TYPE_TEXT[value] || value;
}

const GENRE_TEXT = { SciFi: 'Sci-Fi' };

export function formatGenre(value) {
  return GENRE_TEXT[value] || value;
}

const BOOKING_STATUS_TEXT = { Active: 'Active', Completed: 'Completed', Cancelled: 'Cancelled' };

export function formatBookingStatus(value) {
  return BOOKING_STATUS_TEXT[value] || value;
}

// 订单状态对应的 kit 类名，给 c-status 用：c-status c-status--active
const BOOKING_STATUS_CLASS = {
  Active: 'c-status--active',
  Completed: 'c-status--completed',
  Cancelled: 'c-status--cancelled'
};

export function getStatusClass(value) {
  return BOOKING_STATUS_CLASS[value] || '';
}
