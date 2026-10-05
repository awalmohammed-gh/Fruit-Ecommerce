// Only keys used by this project. Never clear unrelated browser data or harmless preferences.
export function clearObsoleteBrowserStorage() {
  for (const [kind, keys] of [
    ['localStorage', ['app_cart', 'greenfarm.content', 'greenfarm_partner_application_email', 'greenfarm_partner_application']],
    ['sessionStorage', ['greenfarm_partner_application_reference', 'greenfarm.session.customer', 'greenfarm.session.admin', 'greenfarm.session.partner']],
  ] as const) {
    for (const key of keys) {
      try { window[kind].removeItem(key); } catch { /* Browser storage may be disabled. */ }
    }
  }
}
