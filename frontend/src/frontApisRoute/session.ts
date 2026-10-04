/**
 * Sign-ins live in HTTP-only cookies set by the server (customerToken, adminToken, deliveryPartnerToken).
 * The browser sends them by itself and JavaScript can't read them, so nothing here stores a token or any
 * account details. This file only passes on news about sign-ins:
 *
 * - SESSION_ENDED_EVENT: the server said a sign-in ended (expired, signed out elsewhere, password changed,
 *   suspended). detail = the account type, so only that area signs out and goes to its own sign-in page.
 * - SESSION_CHANGED_EVENT: another tab signed that account type in or out. The cookies are shared by every
 *   tab, so this tab re-checks who is signed in instead of showing a different person's screens.
 */
export type Account = "customer" | "admin" | "partner";
const ACCOUNTS: Account[] = ["customer", "admin", "partner"];

export const SESSION_ENDED_EVENT = "greenfarm:session-ended";
export const SESSION_CHANGED_EVENT = "greenfarm:session-changed";

export function endLocalSession(account: Account) {
  window.dispatchEvent(new CustomEvent<Account>(SESSION_ENDED_EVENT, { detail: account }));
}

const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("greenfarm-auth");
channel?.addEventListener("message", (event: MessageEvent<unknown>) => {
  const account = event.data as Account;
  if (ACCOUNTS.includes(account)) window.dispatchEvent(new CustomEvent<Account>(SESSION_CHANGED_EVENT, { detail: account }));
});
/** This tab signed `account` in or out; the other open tabs re-check theirs. */
export function announceSessionChange(account: Account) {
  channel?.postMessage(account);
}

// Earlier versions kept a session ID per tab in sessionStorage. Those are no longer used, so clear them.
try {
  for (const account of ACCOUNTS) sessionStorage.removeItem(`greenfarm.session.${account}`);
} catch { /* storage blocked: nothing to clear */ }
