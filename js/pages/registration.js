import { request, saveTokens } from '../api.js';
import { redirectIfLoggedIn } from '../auth.js';
import { getTodayDateString } from '../format.js';
import { applyPhoneMask, isPhoneComplete } from '../phone.js';
import {
  setLoading, clearFieldError, showFieldErrors,
  setFieldError, showAlert, clearAlerts, showApiError
} from '../ui.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{6,64}$/;

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

  const fieldMap = {
    fullName: { input: nameInput, error: document.querySelector('#reg-name-error') },
    email: { input: emailInput, error: document.querySelector('#reg-email-error') },
    password: { input: passwordInput, error: document.querySelector('#reg-password-error') },
    birthDate: { input: birthInput, error: document.querySelector('#reg-birth-error') },
    gender: { input: maleRadio, error: document.querySelector('#reg-gender-error') },
    phoneNumber: { input: phoneInput, error: document.querySelector('#reg-phone-error') }
  };

  applyPhoneMask(phoneInput);

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    sendRegistration();
  });

  submitButton.disabled = false;

  window.addEventListener('pageshow', function () {
    submitButton.disabled = false;
  });


  async function sendRegistration() {
    for (const fieldName in fieldMap) {
      clearFieldError(fieldMap[fieldName].input, fieldMap[fieldName].error);
    }
    clearAlerts(alertBox);

    const values = {
      fullName: nameInput.value.trim(),
      email: emailInput.value.trim(),
      password: passwordInput.value,
      birthDate: birthInput.value,
      gender: getCheckedGender(),
      phoneNumber: phoneInput.value
    };

    const errors = validate(values);

    if (Object.keys(errors).length > 0) {
      showFieldErrors(errors, fieldMap);
      return;
    }

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
        showAlert(alertBox, error.detail, 'danger');
        setFieldError(emailInput, fieldMap.email.error, error.detail);
      } else if (error.code === 'VALIDATION_ERROR') {
        showFieldErrors(error.errors, fieldMap);
      } else {
        showApiError(error, alertBox);
      }
    } finally {
      setLoading(submitButton, false);
    }
  }
}


function getCheckedGender() {
  const checked = document.querySelector('input[name="gender"]:checked');
  return checked === null ? '' : checked.value;
}


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
