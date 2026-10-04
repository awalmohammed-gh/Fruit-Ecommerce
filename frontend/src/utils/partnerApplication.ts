// Remembers an applicant's delivery partner application on this device.
// The email is kept across visits so the status page can be pre-filled. The reference code works like a
// password for activating the account, so it's only kept for this tab (sessionStorage) and has to be
// typed again in a new tab.
const EMAIL_KEY = "greenfarm_partner_application_email";
const REFERENCE_KEY = "greenfarm_partner_application_reference";
export interface SavedApplication { email: string; reference: string }

export function savedApplication(): SavedApplication | null {
  try {
    const email = localStorage.getItem(EMAIL_KEY);
    return email ? { email, reference: sessionStorage.getItem(REFERENCE_KEY) ?? "" } : null;
  } catch {
    return null;
  }
}
export function saveApplication(value: SavedApplication) {
  try {
    localStorage.setItem(EMAIL_KEY, value.email);
    sessionStorage.setItem(REFERENCE_KEY, value.reference);
  } catch { /* storage unavailable: the code still works when typed */ }
}
export function forgetApplication() {
  try {
    localStorage.removeItem(EMAIL_KEY);
    sessionStorage.removeItem(REFERENCE_KEY);
    localStorage.removeItem("greenfarm_partner_application"); // older versions kept the code here
  } catch { /* nothing to clear */ }
}
