import { apiRequest } from "./client";
export interface CustomerPreferences {
  productSort: 'newest' | 'rating' | 'price_asc' | 'price_desc' | 'name';
  notifications: { order: boolean; account: boolean; promotion: boolean; system: boolean };
}
export interface AuthUser {
  _id: string;
  fullName: string;
  email: string;
  phone: string;
  avatar: string;
  preferences: CustomerPreferences;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface RegisterInput {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
}
// The admin comes from the backend .env, not the users collection, and has its own session.
export interface AdminAccount { _id: string; fullName: string; email: string; phone: string; avatar: string; isActive: boolean; lastLoginAt: string | null; role: "admin"; createdAt: string }
export type ProfileInput = Partial<Pick<AuthUser, "fullName" | "phone" | "avatar">>;
// Signing in sets an HTTP-only cookie; the response only carries the account (see session.ts).
type UserResponse = { user: AuthUser; message?: string };
type SignedIn<T> = T & { message: string };
export const authApi = {
  // The signed-in customer after a refresh, or null when nobody is signed in.
  current: () => apiRequest<{ user: AuthUser | null }>("/auth/me"),
  register: (input: RegisterInput) =>
    apiRequest<SignedIn<UserResponse>>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  // Admin sign-in is separate from customers: its own endpoint, cookie and sign-out.
  adminLogin: (email: string, password: string) =>
    apiRequest<SignedIn<{ admin: AdminAccount }>>("/auth/admin/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  adminCurrent: () => apiRequest<{ admin: AdminAccount | null }>("/auth/admin/me"),
  adminLogout: () => apiRequest<{ message: string }>("/auth/admin/logout", { method: "POST" }),
  login: (email: string, password: string) =>
    apiRequest<SignedIn<UserResponse>>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () =>
    apiRequest<{ message: string }>("/auth/logout", { method: "POST" }),
  updateProfile: (input: ProfileInput, ownerId?: string) =>
    apiRequest<UserResponse>("/auth/profile", {
      method: "PATCH",
      body: JSON.stringify(input),
      headers: ownerId ? { 'X-Profile-Owner': ownerId } : {},
    }),
  uploadAvatar: (file: File, ownerId: string) => {
    const body = new FormData(); body.append('image', file);
    return apiRequest<UserResponse>('/auth/profile/avatar', { method: 'PATCH', body, headers: { 'X-Profile-Owner': ownerId } });
  },
  removeAvatar: (ownerId: string) => apiRequest<UserResponse>('/auth/profile/avatar', { method: 'DELETE', headers: { 'X-Profile-Owner': ownerId } }),
  preferences: (input: Partial<CustomerPreferences>, ownerId: string) => apiRequest<UserResponse>('/auth/preferences', { method: 'PATCH', body: JSON.stringify(input), headers: { 'X-Profile-Owner': ownerId } }),
  changePassword: (currentPassword: string, newPassword: string, ownerId?: string) =>
    apiRequest<SignedIn<UserResponse>>("/auth/password", {
      method: "PATCH",
      body: JSON.stringify({ currentPassword, newPassword }),
      headers: ownerId ? { 'X-Profile-Owner': ownerId } : {},
    }),
};
