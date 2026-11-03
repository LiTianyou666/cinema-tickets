// js/ui.js —— 页面通用小工具
//
// 页面脚本不用各写一遍 toast、提示框、字段错误、加载状态。
//
// 注意：JS 只能改 kit 定义的类与属性，不设样式。

// 提示类型 → 图标名（与 kit 里 c-alert / c-toast 的用法一致）
const ICON_BY_TYPE = {
  info: 'icon-info',
  success: 'icon-check',
  warning: 'icon-warning',
  danger: 'icon-error'
};

// 图标 sprite 的路径（页面都在根目录，所以是 kit/icons.svg）
// 别的模块也要拼图标时从这里 import，别各自写一遍
export const ICON_PATH = 'kit/icons.svg';

function iconName(type) {
  return ICON_BY_TYPE[type] || 'icon-info';
}


// ---------------------------------------------------------------------------
// 1. toast：右下角浮出的小提示，点关闭按钮消失（规格书附录 A.3）
//    用法：showToast('The profile is saved.', 'success');
// ---------------------------------------------------------------------------

export function showToast(message, type) {
  const stack = getToastStack();

  const toast = document.createElement('div');
  toast.className = 'c-toast c-toast--' + type;
  toast.setAttribute('role', 'status');
  toast.innerHTML =
    '<svg class="c-icon c-toast__icon" aria-hidden="true">' +
    '<use href="' + ICON_PATH + '#' + iconName(type) + '"></use></svg>' +
    '<p class="c-toast__text"></p>' +
    '<button class="c-btn c-btn--ghost c-btn--icon c-btn--sm c-toast__close" type="button" aria-label="Close">' +
    '<svg class="c-icon c-icon--sm" aria-hidden="true">' +
    '<use href="' + ICON_PATH + '#icon-close"></use></svg></button>';

  // 消息用 textContent 写入，不拼进 innerHTML：
  // 万一消息里带 < 或 >，也不会被浏览器当成标签
  toast.querySelector('.c-toast__text').textContent = message;

  toast.querySelector('.c-toast__close').addEventListener('click', function () {
    toast.remove();
  });

  stack.appendChild(toast);
  return toast;
}

// 找到页面上的 toast 容器；没有就在 body 末尾造一个
function getToastStack() {
  let stack = document.querySelector('.c-toast-stack');

  if (stack === null) {
    stack = document.createElement('div');
    stack.className = 'c-toast-stack';
    stack.setAttribute('aria-live', 'polite');
    document.body.appendChild(stack);
  }
  return stack;
}


// ---------------------------------------------------------------------------
// 2. alert：页面上的一块提示（登录失败、下单被关闭之类）
//    页面里先留一个空容器，例如 <div id="form-alert"></div>，JS 往里放提示框。
// ---------------------------------------------------------------------------

export function showAlert(container, message, type, actionText, actionHref) {
  clearAlerts(container);

  const alert = document.createElement('div');
  alert.className = 'c-alert c-alert--' + type;
  // 错误和警告用 role="alert"，其他用 role="status"（规格书第 8 章）
  alert.setAttribute('role', type === 'danger' || type === 'warning' ? 'alert' : 'status');

  let html =
    '<svg class="c-icon c-alert__icon" aria-hidden="true">' +
    '<use href="' + ICON_PATH + '#' + iconName(type) + '"></use></svg>' +
    '<div class="c-alert__body"><p></p></div>';

  if (actionText) {
    html += '<div class="c-alert__action">' +
      '<a class="c-btn c-btn--secondary c-btn--sm" href="#"></a></div>';
  }
  alert.innerHTML = html;

  alert.querySelector('.c-alert__body p').textContent = message;

  if (actionText) {
    const link = alert.querySelector('.c-alert__action a');
    link.textContent = actionText;
    link.href = actionHref;
  }

  container.appendChild(alert);
  container.hidden = false;
  return alert;
}

// 清空提示并重新隐藏容器（hidden 的容器不占布局位置，页面外观和 mockup 一致）
export function clearAlerts(container) {
  container.textContent = '';
  container.hidden = true;
}


// ---------------------------------------------------------------------------
// 3. 统一的接口错误显示
//    服务器不可用 → toast；其他业务错误 → 页面上的 alert（规格书 4.3）
// ---------------------------------------------------------------------------

export function showApiError(error, alertContainer) {
  if (error.code === 'SERVER_UNAVAILABLE') {
    showToast(error.detail, 'danger');
    return;
  }
  if (alertContainer) {
    showAlert(alertContainer, error.detail, 'danger');
    return;
  }
  showToast(error.detail, 'danger');
}


// ---------------------------------------------------------------------------
// 4. 表单字段错误（规格书 5.4）
//    错误元素的标记结构（照 mockup 抄的）：
//      <p class="c-field__error" id="login-email-error">
//        <svg class="c-icon c-icon--sm" ...><use href="kit/icons.svg#icon-error"></use></svg>
//        <span>The email address is invalid.</span>
//      </p>
//    所以文字要写进里面的 <span>，不能整个 <p> 覆盖掉，否则图标就没了。
// ---------------------------------------------------------------------------

export function setFieldError(input, errorElement, message) {
  input.setAttribute('aria-invalid', 'true');

  // 输入框本来可能已经用 aria-describedby 指向 hint（提示文字），
  // 这里把错误元素"追加"进去，而不是把它覆盖掉
  const describedBy = input.getAttribute('aria-describedby');

  if (describedBy === null) {
    input.setAttribute('aria-describedby', errorElement.id);
  } else if (describedBy.indexOf(errorElement.id) === -1) {
    input.setAttribute('aria-describedby', describedBy + ' ' + errorElement.id);
  }

  let textSpan = errorElement.querySelector('span');

  if (textSpan === null) {
    textSpan = document.createElement('span');
    errorElement.appendChild(textSpan);
  }
  textSpan.textContent = message;
  errorElement.hidden = false;
}

export function clearFieldError(input, errorElement) {
  input.removeAttribute('aria-invalid');

  // 只把错误元素从 aria-describedby 里摘掉，保留原来的 hint 引用
  const describedBy = input.getAttribute('aria-describedby');

  if (describedBy !== null) {
    const rest = describedBy.split(' ').filter(function (id) {
      return id !== errorElement.id;
    }).join(' ');

    if (rest === '') {
      input.removeAttribute('aria-describedby');
    } else {
      input.setAttribute('aria-describedby', rest);
    }
  }

  const textSpan = errorElement.querySelector('span');
  if (textSpan !== null) {
    textSpan.textContent = '';
  }
  errorElement.hidden = true;
}

// 把服务端返回的 errors 铺到对应字段上：
// fieldMap = { email: { input: 邮箱输入框, error: 邮箱错误元素 }, ... }
export function showFieldErrors(errors, fieldMap) {
  for (const fieldName in errors) {
    const target = fieldMap[fieldName];

    if (target) {
      setFieldError(target.input, target.error, errors[fieldName][0]);
    }
  }
}


// ---------------------------------------------------------------------------
// 5. 加载状态
// ---------------------------------------------------------------------------

// 按钮请求中：加 is-loading、aria-busy，并暂时禁用（规格书 5.3.2）
export function setLoading(button, isLoading) {
  if (isLoading) {
    button.classList.add('is-loading');
    button.setAttribute('aria-busy', 'true');
    button.disabled = true;
  } else {
    button.classList.remove('is-loading');
    button.removeAttribute('aria-busy');
    button.disabled = false;
  }
}

// 整块区域加载中：容器加/去 aria-busy（规格书 5.3.1）
export function setBusy(container, isBusy) {
  if (isBusy) {
    container.setAttribute('aria-busy', 'true');
  } else {
    container.removeAttribute('aria-busy');
  }
}
