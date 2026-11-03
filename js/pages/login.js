// js/pages/login.js —— 登录页 第 6 章
//
// 参考标记：参考资料/snippets/S01a.html（默认）、S01b.html（登录失败）
//
// 流程：提交表单 → POST /api/account/login → 存 token → 跳到 returnUrl

import { request, saveTokens } from '../api.js';
import { redirectIfLoggedIn, getReturnUrl } from '../auth.js';
import {
  setLoading, clearFieldError, showFieldErrors,
  showAlert, clearAlerts, showApiError
} from '../ui.js';

// 已登录的用户不该停在登录页 5.2.3
// redirectIfLoggedIn() 返回 true 表示已经跳转了，那就不必再初始化页面。
if (redirectIfLoggedIn() === false) {
  start();
}

function start() {
  const form = document.querySelector('#login-form');
  const emailInput = document.querySelector('#login-email');
  const passwordInput = document.querySelector('#login-password');
  const emailError = document.querySelector('#login-email-error');
  const passwordError = document.querySelector('#login-password-error');
  const submitButton = document.querySelector('#login-submit');
  const alertBox = document.querySelector('#form-alert');

  // 表单提交时执行 sendLogin()
  form.addEventListener('submit', function (event) {
    event.preventDefault(); // 拦下浏览器的默认提交，改由我们自己发请求
    sendLogin();
  });

  // 监听器挂好了，才把按钮启用
  // 按钮在 HTML 里是 disabled 的，这样脚本还没跑起来时点不动按钮，
  // 表单就不会被原生提交到静态服务器（那会得到 405 Method Not Allowed）
  submitButton.disabled = false;

  // 浏览器后退回到本页时（bfcache 恢复），模块不会重新执行，
  // 按钮可能还停在禁用状态，这里补一下，保证回来也能点
  window.addEventListener('pageshow', function () {
    submitButton.disabled = false;
  });

  async function sendLogin() {
    // 1. 先清掉上一次留下的错误提示。
    clearFieldError(emailInput, emailError);
    clearFieldError(passwordInput, passwordError);
    clearAlerts(alertBox);

    // 2. 按钮进入请求中状态，防止重复点击
    setLoading(submitButton, true);

    try {
      const tokens = await request('/account/login', {
        method: 'POST',
        auth: false,
        body: {
          email: emailInput.value.trim(),
          password: passwordInput.value
        }
      });

      // 3. 成功：存下两个 token，跳到 returnUrl（没有该参数就回首页）
      saveTokens(tokens);
      location.href = getReturnUrl();
    } catch (error) {
      if (error.code === 'VALIDATION_ERROR') {
        // 服务端把每个字段的错误放在 errors 里，直接铺到对应字段下面
        showFieldErrors(error.errors, {
          email: { input: emailInput, error: emailError },
          password: { input: passwordInput, error: passwordError }
        });
      } else if (error.code === 'INVALID_CREDENTIALS') {
        // 6.3：提示显示在字段上方，邮箱保留，密码清空
        showAlert(alertBox, error.detail, 'danger');
        passwordInput.value = '';
      } else {
        // 服务器不可用等情况：统一处理（弹 toast）
        showApiError(error, alertBox);
      }
    } finally {
      // 4. 不管成功还是失败，按钮都要恢复。
      setLoading(submitButton, false);
    }
  }
}
