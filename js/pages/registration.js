// js/pages/registration.js —— 注册页 第 7 章
//
// 参考标记：参考资料/snippets/S02a.html（默认）、S02b.html（校验错误）、S02c.html（邮箱已注册）
//
// 流程：浏览器先校验 → 通过后 POST /api/account/register → 存 token → 跳 index.html

import { request, saveTokens } from '../api.js';
import { redirectIfLoggedIn } from '../auth.js';
import { getTodayDateString } from '../format.js';
import { applyPhoneMask, isPhoneComplete } from '../phone.js';
import {
  setLoading, clearFieldError, showFieldErrors,
  setFieldError, showAlert, clearAlerts, showApiError
} from '../ui.js';

// 校验规则
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{6,64}$/;

// 已登录用户不该停在注册页 5.2.3
if (redirectIfLoggedIn() === false) {
  start();
}

function start() {
  const form = document.querySelector('#reg-form');
  const nameInput = document.querySelector('#reg-name');
  const emailInput = document.querySelector('#reg-email');
  const passwordInput = document.querySelector('#reg-password');
  const birthInput = document.querySelector('#reg-birth');
  const maleRadio = document.querySelector('#reg-gender-male');
  const phoneInput = document.querySelector('#reg-phone');
  const submitButton = document.querySelector('#reg-submit');
  const alertBox = document.querySelector('#form-alert');

  // 每个字段：输入框 + 它下面的错误元素
  // 这里的 key（fullName / email / ...）必须和服务端 errors 里的字段名一致
  const fieldMap = {
    fullName: { input: nameInput, error: document.querySelector('#reg-name-error') },
    email: { input: emailInput, error: document.querySelector('#reg-email-error') },
    password: { input: passwordInput, error: document.querySelector('#reg-password-error') },
    birthDate: { input: birthInput, error: document.querySelector('#reg-birth-error') },
    gender: { input: maleRadio, error: document.querySelector('#reg-gender-error') },
    phoneNumber: { input: phoneInput, error: document.querySelector('#reg-phone-error') }
  };

  // 电话框挂上掩码
  applyPhoneMask(phoneInput);

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    sendRegistration();
  });

  submitButton.disabled = false;

  // 浏览器后退回来时模块不会重新执行，这里补一次
  window.addEventListener('pageshow', function () {
    submitButton.disabled = false;
  });

  // -------------------------------------------------------------------------
  // 提交
  // -------------------------------------------------------------------------

  async function sendRegistration() {
    // 1. 清掉上一次的错误
    for (const fieldName in fieldMap) {
      clearFieldError(fieldMap[fieldName].input, fieldMap[fieldName].error);
    }
    clearAlerts(alertBox);

    // 2. 收集表单值
    const values = {
      fullName: nameInput.value.trim(),
      email: emailInput.value.trim(),
      password: passwordInput.value,
      birthDate: birthInput.value,
      gender: getCheckedGender(),
      phoneNumber: phoneInput.value
    };

    // 3. 浏览器先校验（规则和文案都来自5.4）
    const errors = validate(values);

    if (Object.keys(errors).length > 0) {
      showFieldErrors(errors, fieldMap);
      return;
    }

    // 4. 发请求
    setLoading(submitButton, true);

    try {
      const tokens = await request('/account/register', {
        method: 'POST',
        auth: false,
        body: values
      });

      saveTokens(tokens);
      location.href = 'index.html';
    } catch (error) {
      if (error.code === 'EMAIL_TAKEN') {
        // 7.5：上方 alert 显示 detail，同时把邮箱字段标为无效
        showAlert(alertBox, error.detail, 'danger');
        setFieldError(emailInput, fieldMap.email.error, error.detail);
      } else if (error.code === 'VALIDATION_ERROR') {
        // 服务端返回的 errors 和服务端文案，直接铺到字段下
        showFieldErrors(error.errors, fieldMap);
      } else {
        showApiError(error, alertBox);
      }
    } finally {
      setLoading(submitButton, false);
    }
  }
}


// 当前选中的性别（没选返回空字符串）
function getCheckedGender() {
  const checked = document.querySelector('input[name="gender"]:checked');
  return checked === null ? '' : checked.value;
}


// 浏览器端校验。返回 { 字段名: [错误文案] }，没有错误就返回 {}
function validate(values) {
  const errors = {};
  const today = getTodayDateString();

  if (values.fullName === '' || values.fullName.length > 100) {
    errors.fullName = ['The full name is required.'];
  }
  if (EMAIL_PATTERN.test(values.email) === false) {
    errors.email = ['The email address is invalid.'];
  }
  if (PASSWORD_PATTERN.test(values.password) === false) {
    errors.password = ['The password must contain at least one letter and one digit.'];
  }
  if (values.birthDate === '' || values.birthDate < '1900-01-01' || values.birthDate > today) {
    errors.birthDate = ['The date of birth must be between 1900-01-01 and today.'];
  }
  if (values.gender === '') {
    errors.gender = ['The gender is required.'];
  }
  if (isPhoneComplete(values.phoneNumber) === false) {
    errors.phoneNumber = ['The phone number must match the format +7 (xxx) xxx-xx-xx.'];
  }

  return errors;
}
