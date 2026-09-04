/** Formats a Brazilian phone number as the user types: (21) 99999-9999. */
export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits.length ? '(' + digits : '';
  const middleLen = digits.length > 10 ? 5 : 4;
  if (digits.length <= 2 + middleLen) return '(' + digits.slice(0, 2) + ') ' + digits.slice(2);
  return '(' + digits.slice(0, 2) + ') ' + digits.slice(2, 2 + middleLen) + '-' + digits.slice(2 + middleLen);
}
