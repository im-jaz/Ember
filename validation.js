export function validateCheckout({ name = '', phone = '', address = '', fulfillment = 'delivery' }) {
  if (String(name).trim().length < 2) return 'Please enter your full name.';
  if (!/^[+\d][\d\s()-]{7,}$/.test(String(phone).trim())) return 'Please enter a valid phone number.';
  if (fulfillment === 'delivery' && String(address).trim().length < 8) return 'Please enter a complete delivery address.';
  return null;
}
