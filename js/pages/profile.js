// js/pages/profile.js —— 个人资料页 第 8 章
//
// 参考标记：参考资料/snippets/S03a.html（默认）、S03b.html（已保存 + 校验错误）
//
// 流程：访问控制 → 页头 → GET 资料回填 → 编辑三个字段 → PUT 保存 → toast

import { request } from '../api.js';
import { requireAuth, initHeader } from '../auth.js';
import { getTodayDateString } from '../format.js';
import { applyPhoneMask, formatPhone, isPhoneComplete } from '../phone.js';
import {
  setLoading, clearFieldError, showFieldErrors,
  clearAlerts, showApiError, showToast, setBusy
} from '../ui.js';

// 受限页面：没登录就跳登录页并带上 returnUrl（规格书 5.2.1）
if (requireAuth()) {
  start();
}

async function start() {
  const form = document.querySelector('#profile-form');
  const emailValue = document.querySelector('#profile-email');
  const genderValue = document.querySelector('#profile-gender');
  const nameInput = document.querySelector('#profile-name');
  const birthInput = document.querySelector('#profile-birth');
  const phoneInput = document.querySelector('#profile-phone');
  const submitButton = document.querySelector('#profile-submit');
  const alertBox = document.querySelector('#form-alert');

  const fieldMap = {
    fullName: { input: nameInput, error: document.querySelector('#profile-name-error') },
    birthDate: { input: birthInput, error: document.querySelector('#profile-birth-error') },
    phoneNumber: { input: phoneInput, error: document.querySelector('#profile-phone-error') }
  };

  applyPhoneMask(phoneInput);

  // 页头：换成邮箱 + Log out，并顺手拿到 profile，省掉一次重复请求
  setBusy(document.querySelector('.l-main'), true);
  const profile = await initHeader();
  setBusy(document.querySelector('.l-main'), false);

  if (profile === null) {
    return; // 拿不到资料（通常是没登录），api.js/auth.js 已经处理跳转了
  }

  fillProfile(profile);

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    saveProfile();
  });

  submitButton.disabled = false;
  window.addEventListener('pageshow', function () {
    submitButton.disabled = false;
  });


  // 把服务端返回的资料填进页面
  function fillProfile(data) {
    emailValue.textContent = data.email;
    genderValue.textContent = data.gender;
    nameInput.value = data.fullName;
    birthInput.value = data.birthDate;
    phoneInput.value = formatPhone(data.phoneNumber);
  }


  async function saveProfile() {
    // 1. 清掉上次的错误
    for (const fieldName in fieldMap) {
      clearFieldError(fieldMap[fieldName].input, fieldMap[fieldName].error);
    }
    clearAlerts(alertBox);

    // 2. 只提交可编辑的三个字段（Email / Gender 只读）
    const values = {
      fullName: nameInput.value.trim(),
      birthDate: birthInput.value,
      phoneNumber: phoneInput.value
    };

    // 3. 浏览器先校验
    const errors = validate(values);

    if (Object.keys(errors).length > 0) {
      showFieldErrors(errors, fieldMap);
      return;
    }

    // 4. 提交
    setLoading(submitButton, true);

    try {
      await request('/account/profile', {
        method: 'PUT',
        body: values
      });

      showToast('The profile is saved.', 'success');
    } catch (error) {
      if (error.code === 'VALIDATION_ERROR') {
        showFieldErrors(error.errors, fieldMap);
      } else {
        showApiError(error, alertBox);
      }
    } finally {
      setLoading(submitButton, false);
    }
  }
}


// 浏览器端校验（规则与文案来自5.4）
function validate(values) {
  const errors = {};
  const today = getTodayDateString();

  if (values.fullName === '' || values.fullName.length > 100) {
    errors.fullName = ['The full name is required.'];
  }
  if (values.birthDate === '' || values.birthDate < '1900-01-01' || values.birthDate > today) {
    errors.birthDate = ['The date of birth must be between 1900-01-01 and today.'];
  }
  if (isPhoneComplete(values.phoneNumber) === false) {
    errors.phoneNumber = ['The phone number must match the format +7 (xxx) xxx-xx-xx.'];
  }

  return errors;
}
