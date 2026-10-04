import { apiRequest } from "./client";
import type { AdminAccount, ProfileInput } from "./auth";

export interface AdminPreferences {
  appearance: "light" | "dark" | "system";
  sidebar: "expanded" | "collapsed";
  tableDensity: "comfortable" | "compact";
  pageSize: 10 | 20 | 50 | 100;
  dateFormat: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  timeFormat: "12-hour" | "24-hour";
  currencyDisplay: "symbol" | "code";
}

export const DEFAULT_ADMIN_PREFERENCES: AdminPreferences = {
  appearance: "light", sidebar: "expanded", tableDensity: "comfortable", pageSize: 20,
  dateFormat: "DD/MM/YYYY", timeFormat: "24-hour", currencyDisplay: "symbol",
};

export const adminSettingsApi = {
  profile: (input: ProfileInput) => apiRequest<{ admin: AdminAccount; message: string }>("/admin/account/profile", { method: "PATCH", body: JSON.stringify(input) }),
  password: (currentPassword: string, newPassword: string, confirmPassword: string) =>
    apiRequest<{ message: string }>("/admin/account/password", { method: "PATCH", body: JSON.stringify({ currentPassword, newPassword, confirmPassword }) }),
  preferences: () => apiRequest<{ preferences: AdminPreferences }>("/admin/preferences"),
  savePreferences: (preferences: AdminPreferences) => apiRequest<{ preferences: AdminPreferences; message: string }>("/admin/preferences", { method: "PATCH", body: JSON.stringify(preferences) }),
};
