import React, { useState } from "react";
import { heroSectionData } from "../assets/assets";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import toast, { errorMessage } from "../components/toast/toast";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import Loading from "../components/card/Loading";
import { CUSTOMER_HOME, customerDestination } from "../utils/customerRedirect";
import {
  Loader2Icon,
  Lock,
  MailIcon,
  UserIcon,
} from "lucide-react";

const Login = () => {
  const [searchParams] = useSearchParams();
  const [isLoginState, setIsLoginState] = useState(searchParams.get("mode") !== "signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, register, user, loading: sessionLoading } = useCustomerAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Customer sign-in only (the admin uses /admin/login). Customers go back to the page that sent them here,
  // e.g. checkout. The page is kept in router state, which also survives a refresh of this page.
  const destination = customerDestination(location.state?.from) ?? CUSTOMER_HOME;

  const handleSubmit = async (e:React.SubmitEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const signedIn = await (isLoginState ? login(email, password) : register({ fullName: name.trim(), email, phone, password }));
      toast.success(isLoginState ? `Welcome back, ${signedIn.fullName.split(" ")[0]}` : "Account created", isLoginState ? undefined : { description: "Welcome to GreenFarm." });
      navigate(destination, { replace: true });
    } catch (error) {
      // The server's own message (e.g. "This email is already registered"), shown on the form and as a toast.
      const message = errorMessage(error, isLoginState ? "Unable to sign in" : "Unable to create your account");
      setError(message);
      toast.error(message);
    }
    finally { setLoading(false); }
  };

  if (sessionLoading) return <Loading fullScreen label="Checking your session" />;
  if (user) return <Navigate to={destination} replace />;

  return (
    <div className="min-h-dvh flex">
      {/* left side */}
      <div className="hidden lg:flex lg:w-1/2 bg-app-green relative items-center justify-center overflow-hidden">
        <img
          className="absolute inset-0 w-full h-full object-cover opacity-10"
          src={heroSectionData.hero_image}
          alt="hero image"
        />
        <div className="relative text-center px-12 z-10">
          <h2 className="text-5xl font-bold text-white mb-6 leading-tight">
            Welcome Back to <span className="text-green-300">Green Farm</span>
          </h2>
          <div className="w-20 h-1 bg-green-400 mx-auto mb-6 rounded-full"></div>
          <p className="text-white/80 font-serif text-xl max-w-sm mx-auto leading-relaxed">
            Log in to manage your orders, wishlist, and account settings.
          </p>
        </div>
      </div>

      {/* right side */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 bg-app-cream">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <Link
              to={"/"}
              className="inline-flex items-center gap-2 mb-8 group"
            >
              <p className="text-3xl text-black font-semibold tracking-tight">
                Green<span className="font-bold text-green-600">Farm</span>
              </p>
            </Link>
            <h1 className="text-3xl font-bold text-gray-800 mb-3">
              {isLoginState ? "Sign in to your account" : "Create an account"}
            </h1>
            <p className="text-sm text-app-text-light">
              {isLoginState
                ? "Don't have an account?"
                : "Already have an account?"}{" "}
              <button
                className="text-orange-500 ml-1 font-semibold hover:text-orange-600 transition-all duration-300 hover:underline"
                disabled={loading}
                onClick={() => { setIsLoginState((prev) => !prev); setError(""); }}
              >
                {isLoginState ? "Create one" : "Sign in"}
              </button>
            </p>
          </div>

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
              <button onClick={() => toast.info("Password recovery isn't available yet", { description: "You can change your password in My Account after signing in." })} className="text-sm text-app-text-light hover:text-green-600 transition-colors duration-300">
                Forgot your password?
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
