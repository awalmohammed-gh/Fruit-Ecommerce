import { heroSectionData } from "../assets/assets";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import Loading from "../components/card/Loading";
import CustomerAuthForm from "../components/auth/CustomerAuthForm";
import { CUSTOMER_HOME, customerDestination } from "../utils/customerRedirect";

const Login = () => {
  const [searchParams] = useSearchParams();
  const { user, loading: sessionLoading } = useCustomerAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Customer sign-in only (the admin uses /admin/login). Customers go back to the page that sent them here,
  // e.g. checkout. The page is kept in router state, which also survives a refresh of this page.
  const destination = customerDestination(location.state?.from) ?? CUSTOMER_HOME;

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
          <div className="text-center">
            <Link
              to={"/"}
              className="inline-flex items-center gap-2 mb-8 group"
            >
              <p className="text-3xl text-black font-semibold tracking-tight">
                Green<span className="font-bold text-green-600">Farm</span>
              </p>
            </Link>
          </div>
          <CustomerAuthForm
            initialMode={searchParams.get("mode") === "signup" ? "signup" : "login"}
            onSuccess={() => navigate(destination, { replace: true })}
          />
        </div>
      </div>
    </div>
  );
};

export default Login;
