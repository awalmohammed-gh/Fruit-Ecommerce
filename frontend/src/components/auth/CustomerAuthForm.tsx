import React, { useState, type ReactNode } from "react";
import { Loader2Icon, Lock, MailIcon, UserIcon } from "lucide-react";
import toast, { errorMessage } from "../toast/toast";
import { useCustomerAuth } from "../../context/CustomerAuthContext";

interface Props {
  initialMode?: "login" | "signup";
  /** "h1" on the sign-in page, "h2" inside a dialog (whose title it is, via headingId). */
  heading?: "h1" | "h2";
  headingId?: string;
  /** Shown above the form, e.g. why the shopper is being asked to sign in. */
  notice?: ReactNode;
  onBusyChange?: (busy: boolean) => void;
  /** After signing in or creating an account. The customer session is already updated. */
  onSuccess?: () => void;
}

// Customer sign-in and sign-up, shared by the /login page and the sign-in dialog.
export default function CustomerAuthForm({ initialMode = "login", heading: Heading = "h1", headingId, notice, onBusyChange, onSuccess }: Props) {
  const [isLoginState, setIsLoginState] = useState(initialMode !== "signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, register } = useCustomerAuth();

  const busy = (value: boolean) => { setLoading(value); onBusyChange?.(value); };

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    busy(true);
    setError("");
    try {
      const signedIn = await (isLoginState ? login(email, password) : register({ fullName: name.trim(), email, phone, password }));
      toast.success(isLoginState ? `Welcome back, ${signedIn.fullName.split(" ")[0]}` : "Account created", isLoginState ? undefined : { description: "Welcome to GreenFarm." });
      busy(false);
      onSuccess?.();
    } catch (error) {
      // The server's own message (e.g. "This email is already registered"), shown on the form and as a toast.
      const message = errorMessage(error, isLoginState ? "Unable to sign in" : "Unable to create your account");
      setError(message);
      toast.error(message);
      busy(false);
    }
  };

  return (
    <>
      <div className="text-center mb-10">
        <Heading id={headingId} className="text-3xl font-bold text-gray-800 mb-3">
          {isLoginState ? "Sign in to your account" : "Create an account"}
        </Heading>
        <p className="text-sm text-app-text-light">
          {isLoginState
            ? "Don't have an account?"
            : "Already have an account?"}{" "}
          <button
            type="button"
            className="text-orange-500 ml-1 font-semibold hover:text-orange-600 transition-all duration-300 hover:underline"
            disabled={loading}
            onClick={() => { setIsLoginState((prev) => !prev); setError(""); }}
          >
            {isLoginState ? "Create one" : "Sign in"}
          </button>
        </p>
      </div>

      {notice}

      {/* Login form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {!isLoginState && (
          <div className="space-y-1">
            <label htmlFor="register-name" className="text-sm font-semibold text-gray-700 ml-1">
              Full Name
            </label>
            <div className="relative group">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-app-text-light group-focus-within:text-green-600 transition-colors duration-300" />
              <input
                type="text"
                id="register-name"
                autoComplete="name"
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Mohammed Awal"
                className="w-full pl-12 pr-4 py-3 text-sm bg-white rounded-xl border border-app-border focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none transition-all duration-300"
              />
            </div>
          </div>
        )}

        {!isLoginState && <div className="space-y-1">
          <label htmlFor="register-phone" className="text-sm font-semibold text-gray-700 ml-1">Phone (optional)</label>
          <input id="register-phone" type="tel" autoComplete="tel" maxLength={25} value={phone} onChange={(event) => setPhone(event.target.value)}
            placeholder="e.g. 024 123 4567" className="w-full px-4 py-3 text-sm bg-white rounded-xl border border-app-border focus:ring-2 focus:ring-green-500/20 outline-none" />
        </div>}

        <div className="space-y-1">
          <label htmlFor="auth-email" className="text-sm font-semibold text-gray-700 ml-1">
            Email Address
          </label>
          <div className="relative group">
            <MailIcon className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-app-text-light group-focus-within:text-green-600 transition-colors duration-300" />
            <input
              type="email"
              id="auth-email"
              autoComplete="email"
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full pl-12 pr-4 py-3 text-sm bg-white rounded-xl border border-app-border focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none transition-all duration-300"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="auth-password" className="text-sm font-semibold text-gray-700 ml-1">
            Password
          </label>
          <div className="relative group">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-app-text-light group-focus-within:text-green-600 transition-colors duration-300" />
            <input
              type="password"
              id="auth-password"
              autoComplete={isLoginState ? "current-password" : "new-password"}
              minLength={isLoginState ? undefined : 8}
              maxLength={72}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full pl-12 pr-4 py-3 text-sm bg-white rounded-xl border border-app-border focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none transition-all duration-300"
            />
          </div>
        </div>

        <button
          className="flex items-center justify-center gap-2 w-full py-3.5 bg-green-950 text-white font-semibold rounded-xl hover:bg-green-900 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
          disabled={loading}
          type="submit"
        >
          {loading ? (
            <Loader2Icon className="animate-spin size-5" />
          ) : isLoginState ? (
            "Sign In"
          ) : (
            "Sign Up"
          )}
        </button>
      </form>

      {isLoginState && (
        <div className="mt-6 text-center">
          <button type="button" onClick={() => toast.info("Password recovery isn't available yet", { description: "You can change your password in My Account after signing in." })} className="text-sm text-app-text-light hover:text-green-600 transition-colors duration-300">
            Forgot your password?
          </button>
        </div>
      )}
    </>
  );
}
