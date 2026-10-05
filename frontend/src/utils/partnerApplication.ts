// Application codes authorize lookup and activation. Keep them only in memory across client-side
// navigation; a refresh or a new tab requires the applicant to enter their saved code again.
export interface SavedApplication { email: string; reference: string }
let application: SavedApplication | null = null;

export function savedApplication(): SavedApplication | null {
  return application ? { ...application } : null;
}
export function saveApplication(value: SavedApplication) {
  application = { ...value };
}
export function forgetApplication() {
  application = null;
}
