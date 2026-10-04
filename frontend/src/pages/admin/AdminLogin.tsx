import { useState, type SubmitEvent, type KeyboardEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeftIcon, ArrowRightIcon, EyeIcon, EyeOffIcon, LeafIcon, LoaderCircleIcon, LockIcon, MailIcon, ShieldCheckIcon } from "lucide-react";
import { useAdminAuth } from "../../context/AdminAuthContext";
import styles from "./AdminLogin.module.css";

export default function AdminLogin() {
  const { admin, loading: sessionLoading, login: adminLogin } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requested: unknown = location.state?.from;
  const destination = typeof requested === "string" && (requested === "/admin" || requested.startsWith("/admin/")) && !requested.startsWith("/admin/login") ? requested : "/admin/dashboard";

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try { await adminLogin(email, password); navigate(destination, { replace: true }); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to sign in"); }
    finally { setLoading(false); }
  };
  const trackCapsLock = (event: KeyboardEvent<HTMLInputElement>) => setCapsLock(event.getModifierState("CapsLock"));
  if (admin && !sessionLoading) return <Navigate to={destination} replace />;

  return <div className={styles.page}>
    <header className={styles.header}>
      <Link to="/" className={styles.brand} aria-label="GreenFarm home">
        <span className={styles.brandMark}><LeafIcon size={19} aria-hidden="true" /></span>
        <span>Green<strong>Farm</strong></span>
      </Link>
      <Link to="/" className={styles.back}><ArrowLeftIcon size={14} aria-hidden="true" />Back to store</Link>
    </header>
    <main className={styles.main}>
      <div className={styles.container}>
        <section className={styles.card} aria-labelledby="admin-login-title">
          <div className={styles.intro}>
            <span className={styles.icon}><ShieldCheckIcon size={24} aria-hidden="true" /></span>
            <span className={styles.badge}>Admin access</span>
          </div>
          <p className={styles.eyebrow}>Store management</p>
          <h1 id="admin-login-title" className={styles.title}>Admin sign in</h1>
          <p className={styles.subtitle}>Welcome back. Let’s get your store ready.</p>
          {sessionLoading ? <p role="status" className={styles.support}>Checking your session...</p> : <>
            <form onSubmit={handleSubmit} className={styles.form} aria-busy={loading}>
              <div>
                <label htmlFor="admin-email" className={styles.label}>Email address</label>
                <div className={styles.inputWrap}>
                  <MailIcon className={styles.inputIcon} aria-hidden="true" />
                  <input id="admin-email" type="email" autoComplete="username" required maxLength={254} disabled={loading}
                    value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }}
                    placeholder="Enter your admin email" aria-invalid={!!error} aria-describedby={error ? "admin-login-error" : undefined} className={styles.input} />
                </div>
              </div>
              <div>
                <label htmlFor="admin-password" className={styles.label}>Password</label>
                <div className={styles.inputWrap}>
                  <LockIcon className={styles.inputIcon} aria-hidden="true" />
                  <input id="admin-password" type={showPassword ? "text" : "password"} autoComplete="current-password" required disabled={loading}
                    value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }}
                    onKeyDown={trackCapsLock} onKeyUp={trackCapsLock} onBlur={() => setCapsLock(false)} placeholder="Enter your password"
                    aria-invalid={!!error} aria-describedby={[error ? "admin-login-error" : "", capsLock ? "admin-caps-lock" : ""].filter(Boolean).join(" ") || undefined}
                    className={`${styles.input} ${styles.passwordInput}`} />
                  <button type="button" disabled={loading} onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} className={styles.toggle}>
                    {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                  </button>
                </div>
                {capsLock && <p id="admin-caps-lock" className={styles.capsLock}>Caps Lock is on</p>}
              </div>
              {error && <p id="admin-login-error" role="alert" className={styles.error}>{error}</p>}
              <button type="submit" disabled={loading} className={styles.submit}>
                {loading ? <><LoaderCircleIcon className={styles.spinner} aria-hidden="true" />Signing in...</> : <>Sign in to dashboard<ArrowRightIcon aria-hidden="true" /></>}
              </button>
            </form>
          </>}
          <div className={styles.cardFooter}><LockIcon size={12} aria-hidden="true" />For authorized store administrators</div>
        </section>
        <p className={styles.support}>Shopping with us? <Link to="/login">Customer sign in</Link></p>
      </div>
    </main>
    <footer className={styles.footer}>GreenFarm · Store management</footer>
  </div>;
}
