// js/phone.js —— 电话掩码 +7 (xxx) xxx-xx-xx（规格书 5.4，必须自己实现）
//
// 思路只有两步，别想复杂：
//   1. 把输入里所有非数字字符删掉，只留数字（顺便处理粘贴时开头多出来的 7 或 8）
//   2. 按 3-3-2-2 分组，把数字重新拼成带分隔符的样子
//
// 输入框的 value 本身就是掩码格式，提交时直接发 input.value 就行。

// 完整掩码：+7 加 10 位数字
const MASK_PATTERN = /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/;


// 从任意输入里取出最多 10 位号码
export function getPhoneDigits(value) {
  let digits = value.replace(/\D/g, ''); // \D 表示"非数字"，全部删掉

  // 粘贴 89131234567 或 +79131234567 时，开头会多一个 7 或 8，只保留后 10 位
  if (digits.length > 10) {
    digits = digits.slice(digits.length - 10);
  }

  return digits;
}


// 把号码拼成掩码格式；没输入时返回空字符串
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


// 是否已经输完整（提交前校验用）
export function isPhoneComplete(value) {
  return MASK_PATTERN.test(value);
}


// 把掩码挂到输入框上：每输入一个字符就重新格式化一次
export function applyPhoneMask(input) {
  input.addEventListener('input', function () {
    input.value = formatPhone(input.value);
  });
}
