import { request, saveTokens } from '../api.js';
import { redirectIfLoggedIn, getReturnUrl } from '../auth.js';
import {
  setLoading, clearFieldError, showFieldErrors,
  showAlert, clearAlerts, showApiError
} from '../ui.js';

// a logged in user does not stay on this page
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

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    sendLogin();
  });

  submitButton.disabled = false;

  window.addEventListener('pageshow', function () {
    submitButton.disabled = false;
  });

  // submit
  async function sendLogin() {
    clearFieldError(emailInput, emailError);
    clearFieldError(passwordInput, passwordError);
    clearAlerts(alertBox);

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

      saveTokens(tokens);
      location.href = getReturnUrl();
    } catch (error) {
      if (error.code === 'VALIDATION_ERROR') {
        showFieldErrors(error.errors, {
          email: { input: emailInput, error: emailError },
          password: { input: passwordInput, error: passwordError }
        });
      } else if (error.code === 'INVALID_CREDENTIALS') {
        showAlert(alertBox, error.detail, 'danger');
        passwordInput.value = '';
      } else {
        showApiError(error, alertBox);
      }
    } finally {
      setLoading(submitButton, false);
    }
  }
}
