const MASK_PATTERN = /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/;


// keep digits only
export function getPhoneDigits(value) {
  let digits = value.replace(/\D/g, '');

  if (digits.length > 10) {
    digits = digits.slice(digits.length - 10);
  }

  return digits;
}


// rebuild as +7 (xxx) xxx-xx-xx
export function formatPhone(value) {
  const digits = getPhoneDigits(value);

  if (digits === '') {
    return '';
  }

  let result = '+7 (' + digits.slice(0, 3);

  if (digits.length > 3) {
    result = result + ') ' + digits.slice(3, 6);
  }
  if (digits.length > 6) {
    result = result + '-' + digits.slice(6, 8);
  }
  if (digits.length > 8) {
    result = result + '-' + digits.slice(8, 10);
  }

  return result;
}


export function isPhoneComplete(value) {
  return MASK_PATTERN.test(value);
}


// reformat on every input
export function applyPhoneMask(input) {
  input.addEventListener('input', function () {
    input.value = formatPhone(input.value);
  });
}
