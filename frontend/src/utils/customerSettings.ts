export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export function photoError(file: { type: string; size: number }) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Choose a JPG, PNG or WebP image.';
  if (file.size > PHOTO_MAX_BYTES) return 'Your photo must be 5 MB or smaller.';
  if (!file.size) return 'This image is empty. Choose another photo.';
  return '';
}
export function profileErrors(name: string, phone: string) {
  const digits = phone.replace(/\D/g, '').length;
  return {
    fullName: !name.trim() ? 'Enter your full name.' : name.trim().length > 100 ? 'Use no more than 100 characters.' : '',
    phone: phone.trim() && (!/^[+\d\s().-]+$/.test(phone.trim()) || digits < 7 || digits > 15 || phone.trim().length > 25) ? 'Enter a valid phone number with 7–15 digits.' : '',
  };
}
export function passwordErrors(current: string, next: string, confirm: string) {
  return {
    current: !current ? 'Enter your current password.' : new TextEncoder().encode(current).length > 72 ? 'Use no more than 72 bytes.' : '',
    next: next.length < 8 ? 'Use at least 8 characters.' : new TextEncoder().encode(next).length > 72 ? 'Use no more than 72 bytes.' : next === current ? 'Choose a different new password.' : '',
    confirm: next !== confirm ? 'Passwords do not match.' : !confirm ? 'Confirm your new password.' : '',
  };
}
