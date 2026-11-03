import { request } from '../api.js';
import { requireAuth, initHeader } from '../auth.js';
import { getTodayDateString } from '../format.js';
import { applyPhoneMask, formatPhone, isPhoneComplete } from '../phone.js';
import {
  setLoading, clearFieldError, showFieldErrors,
  clearAlerts, showApiError, showToast, setBusy
} from '../ui.js';

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

  setBusy(document.querySelector('.l-main'), true);
  const profile = await initHeader();
  setBusy(document.querySelector('.l-main'), false);

  if (profile === null) {
    return;
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


  function fillProfile(data) {
    emailValue.textContent = data.email;
    genderValue.textContent = data.gender;
    nameInput.value = data.fullName;
    birthInput.value = data.birthDate;
    phoneInput.value = formatPhone(data.phoneNumber);
  }


  async function saveProfile() {
    for (const fieldName in fieldMap) {
      clearFieldError(fieldMap[fieldName].input, fieldMap[fieldName].error);
    }
    clearAlerts(alertBox);

    const values = {
      fullName: nameInput.value.trim(),
      birthDate: birthInput.value,
      phoneNumber: phoneInput.value
    };

    const errors = validate(values);

    if (Object.keys(errors).length > 0) {
      showFieldErrors(errors, fieldMap);
      return;
    }

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
