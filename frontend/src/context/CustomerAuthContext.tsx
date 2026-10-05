import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { authApi, type AuthUser, type ProfileInput, type RegisterInput, type CustomerPreferences } from "../frontApisRoute/auth";
import { ApiError } from "../frontApisRoute/client";
import { SESSION_CHANGED_EVENT, SESSION_ENDED_EVENT, announceSessionChange, type Account } from "../frontApisRoute/session";
export type { AuthUser } from "../frontApisRoute/auth";

/** The signed-in shopper. Only ever a customer; the admin and delivery partners have their own contexts. */
interface CustomerAuth {
  user: AuthUser | null; isAuthenticated: boolean; loading: boolean; error: string | null;
  /** True after the shopper pressed Sign out (not when a session simply expired). */
  signedOut: boolean;
  retrySession: () => void;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (input: RegisterInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
  updateProfile: (input: ProfileInput) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  removeAvatar: () => Promise<void>;
  updatePreferences: (input: Partial<CustomerPreferences>) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}
const CustomerAuthContext = createContext<CustomerAuth | undefined>(undefined);

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  // The customerToken cookie is HTTP-only, so only the server can say whether someone is signed in.
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [signedOut, setSignedOut] = useState(false);

  // On load (and refresh), and when another tab signs in or out: ask the server who is signed in.
  useEffect(() => {
    let active = true;
    authApi.current().then(({ user }) => { if (active) { setUser(user); setError(null); } })
      .catch((failure: unknown) => {
        if (!active) return;
        setUser(null);
        // 401: the sign-in expired and the server cleared its cookie, so this browser is simply signed out.
        setError(failure instanceof ApiError && failure.status === 401 ? null : failure instanceof Error ? failure.message : "Unable to check your session");
      }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);

  useEffect(() => {
    const ended = (event: Event) => { if ((event as CustomEvent<Account>).detail === "customer") setUser(null); };
    const changed = (event: Event) => {
      if ((event as CustomEvent<Account>).detail !== "customer") return;
      // Shared cookies may now belong to a different shopper; hide the previous shopper's data at once.
      setUser(null);
      setLoading(true);
      setAttempt((value) => value + 1);
    };
    window.addEventListener(SESSION_ENDED_EVENT, ended);
    window.addEventListener(SESSION_CHANGED_EVENT, changed);
    return () => {
      window.removeEventListener(SESSION_ENDED_EVENT, ended);
      window.removeEventListener(SESSION_CHANGED_EVENT, changed);
    };
  }, []);

  const signedIn = (result: { user: AuthUser }) => {
    setUser(result.user);
    setSignedOut(false);
    setError(null);
    announceSessionChange("customer");
    return result.user;
  };
  const login = async (email: string, password: string) => signedIn(await authApi.login(email, password));
  const register = async (input: RegisterInput) => signedIn(await authApi.register(input));
  const logout = async () => {
    await authApi.logout();
    setSignedOut(true);
    setUser(null);
    announceSessionChange("customer");
  };
  const updateAccount = async (request: (ownerId: string) => Promise<{ user: AuthUser }>) => {
    if (!user) throw new Error('Please sign in again');
    const ownerId = user._id;
    const result = await request(ownerId);
    // An upload can complete after sign-out or a shared-cookie account switch.
    setUser((current) => current?._id === ownerId ? result.user : current);
  };
  const updateProfile = (input: ProfileInput) => updateAccount((ownerId) => authApi.updateProfile(input, ownerId));
  const uploadAvatar = (file: File) => updateAccount((ownerId) => authApi.uploadAvatar(file, ownerId));
  const removeAvatar = () => updateAccount(authApi.removeAvatar);
  const updatePreferences = (input: Partial<CustomerPreferences>) => updateAccount((ownerId) => authApi.preferences(input, ownerId));
  // A password change ends every other sign-in and gives this browser a fresh one.
  const changePassword = async (current: string, next: string) => {
    await updateAccount((ownerId) => authApi.changePassword(current, next, ownerId));
    announceSessionChange('customer');
  };

  return (
    <CustomerAuthContext.Provider value={{
      user, isAuthenticated: !!user, loading, error, signedOut,
      retrySession: () => { setLoading(true); setAttempt((value) => value + 1); },
      login, register, logout, updateProfile, uploadAvatar, removeAvatar, updatePreferences, changePassword,
    }}>{children}</CustomerAuthContext.Provider>
  );
}
// eslint-disable-next-line react-refresh/only-export-components
export function useCustomerAuth() {
  const context = useContext(CustomerAuthContext);
  if (!context) throw new Error("useCustomerAuth must be used within CustomerAuthProvider");
  return context;
}
