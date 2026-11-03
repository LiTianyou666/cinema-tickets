const ICON_BY_TYPE = {
  info: 'icon-info',
  success: 'icon-check',
  warning: 'icon-warning',
  danger: 'icon-error'
};

export const ICON_PATH = 'kit/icons.svg';

function iconName(type) {
  return ICON_BY_TYPE[type] || 'icon-info';
}


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

  toast.querySelector('.c-toast__text').textContent = message;

  toast.querySelector('.c-toast__close').addEventListener('click', function () {
    toast.remove();
  });

  stack.appendChild(toast);
  return toast;
}

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


export function showAlert(container, message, type, actionText, actionHref) {
  clearAlerts(container);

  const alert = document.createElement('div');
  alert.className = 'c-alert c-alert--' + type;
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

export function clearAlerts(container) {
  container.textContent = '';
  container.hidden = true;
}


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


//      <p class=c-field__error id=login-email-error>
//        <svg class=c-icon c-icon--sm ...><use href=kit/icons.svg#icon-error></use></svg>
//        <span>The email address is invalid.</span>
//      </p>

export function setFieldError(input, errorElement, message) {
  input.setAttribute('aria-invalid', 'true');

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

export function showFieldErrors(errors, fieldMap) {
  for (const fieldName in errors) {
    const target = fieldMap[fieldName];

    if (target) {
      setFieldError(target.input, target.error, errors[fieldName][0]);
    }
  }
}


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

export function setBusy(container, isBusy) {
  if (isBusy) {
    container.setAttribute('aria-busy', 'true');
  } else {
    container.removeAttribute('aria-busy');
  }
}
