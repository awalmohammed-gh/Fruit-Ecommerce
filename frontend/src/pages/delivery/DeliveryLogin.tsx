import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { BikeIcon, LoaderCircleIcon } from "lucide-react";
import { usePartnerAuth } from "../../context/PartnerAuthContext";
import deliveryIllustration from "../../assets/delivery-login.jpg";
import { inputClass } from "../../components/Delivery/ApplicationForm";

// Delivery partner sign-in. Checks DeliveryPartner accounts only; customer accounts can't sign in here.
export default function DeliveryLogin() {
  const navigate = useNavigate();
  const { partner, login } = usePartnerAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      await login(email.trim(), password);
      navigate("/delivery-partner/dashboard", { replace: true });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to sign in");
      setLoading(false);
    }
  };

  if (partner) return <Navigate to="/delivery-partner/dashboard" replace />;

  return (
    <div className="min-h-dvh flex">
      {/* Illustration side: the whole picture sits at the bottom; the space above is the same sky colour and holds the heading. */}
      <div className="hidden lg:flex lg:w-1/2 flex-col bg-[#a0e3eb] overflow-hidden">
        <img src={deliveryIllustration} alt="A GreenFarm delivery van, a courier with parcels and a rider on a scooter in the city" className="order-last w-full h-auto [clip-path:inset(4px_0_0_0)]" />
        <div className="flex-1 flex flex-col justify-center text-center px-12 py-10">
          <h2 className="text-4xl font-semibold text-app-green mb-3">Delivery Partner Dashboard</h2>
          <p className="text-app-green/75 font-serif text-xl max-w-sm mx-auto">Your assigned deliveries, one tap at a time.</p>
        </div>
      </div>

      <div className="flex-1 flex-center px-4 py-12 bg-app-cream">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2 mb-4">
              <BikeIcon className="size-7 text-app-green" aria-hidden="true" />
              <span className="text-2xl font-semibold text-app-green">GreenFarm</span>
            </Link>
            <h1 className="text-2xl font-semibold text-app-green mb-2">Delivery partner sign in</h1>
            <p className="text-sm text-app-text-light">This is separate from a GreenFarm shopping account.</p>
          </div>

          <form onSubmit={submit} className="bg-white rounded-2xl p-6 sm:p-8 space-y-5 shadow-sm">
            {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <label className="block text-sm font-medium text-app-green">Email
              <input type="email" required autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} className={`${inputClass} mt-1.5`} placeholder="you@example.com" />
            </label>
            <label className="block text-sm font-medium text-app-green">Password
              <input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className={`${inputClass} mt-1.5`} placeholder="••••••••" />
            </label>
            <button type="submit" disabled={loading} className="w-full h-12 bg-app-green text-white font-semibold rounded-xl hover:bg-app-green-light disabled:opacity-60 flex-center gap-2">
              {loading && <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />} {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="mt-6 space-y-2 text-center text-sm text-app-text-light">
            <p>Approved but haven't set a password? <Link to="/delivery-partner/status" className="font-semibold text-app-green hover:underline">Activate your account</Link></p>
            <p>Not a partner yet? <Link to="/delivery-partner/apply" className="font-semibold text-app-green hover:underline">Become a delivery partner</Link></p>
          </div>
        </div>
      </div>
    </div>
  );
}
