import {
  BellIcon,
  ChevronDownIcon,
  LifeBuoyIcon,
  LogOutIcon,
  LogInIcon,
  MapPinIcon,
  Package2Icon,
  UserIcon,
  UserPlusIcon,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCustomerAuth, type AuthUser } from "../../context/CustomerAuthContext";
import { useClickOutside } from "../../hooks/useClickOutside";
import { dropdownPanel } from "./navConfig";
import UserAvatar from "./UserAvatar";
import toast from "../toast/toast";

const accountLinks = [
  { name: "My Account", path: "/account", icon: UserIcon },
  { name: "My Orders", path: "/my-orders", icon: Package2Icon },
  { name: "Saved Addresses", path: "/my-address", icon: MapPinIcon },
  { name: "Notifications", path: "/account?tab=notifications", icon: BellIcon },
];

const UserMenu = ({ user }: { user: AuthUser | null }) => {
  const { logout } = useCustomerAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);

  const handleLogout = async () => {
    setLoggingOut(true);
    try { await logout(); close(); navigate("/"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Unable to sign out"); }
    finally { setLoggingOut(false); }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-controls="navbar-account-menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-1.5 p-1 rounded-full hover:bg-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-green/30"
      >
        {user ? <UserAvatar name={user.fullName} avatar={user.avatar} className="size-7 text-sm" /> : <UserIcon className="size-5 text-zinc-900" aria-hidden="true" />}
        <ChevronDownIcon
          className={`size-3 text-zinc-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <div
        id="navbar-account-menu"
        aria-label="Account options"
        inert={!open}
        className={`absolute right-0 top-full mt-2.5 w-64 bg-white rounded-xl shadow-lg border border-app-border py-2 z-50 origin-top-right ${dropdownPanel(open)}`}
      >
        {user ? <>
        <div className="flex items-center gap-3 px-4 pt-1 pb-3 border-b border-app-border">
          <UserAvatar name={user.fullName} avatar={user.avatar} className="size-9 text-base" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-900 truncate">{user.fullName}</p>
            <p className="text-xs text-zinc-500 truncate">{user.email}</p>
          </div>
        </div>

        <div className="py-1">
          {accountLinks.map(({ name, path, icon: Icon }) => (
            <Link key={name} to={path} onClick={close} className="dropdown-link">
              <Icon size={16} />
              {name}
            </Link>
          ))}
        </div>

        <div className="border-t border-app-border py-1">
          <Link to="/account?tab=help" onClick={close} className="dropdown-link">
            <LifeBuoyIcon size={16} />
            Help & Support
          </Link>
        </div>

        <div className="border-t border-app-border pt-1">
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-500 hover:text-app-error hover:bg-red-50 w-full transition-colors"
          >
            <LogOutIcon size={16} />
            {loggingOut ? "Signing out..." : "Logout"}
          </button>
        </div>
        </> : <>
          <Link to="/login" onClick={close} className="dropdown-link">
            <LogInIcon size={16} />
            Sign in
          </Link>
          <Link to="/login?mode=signup" onClick={close} className="dropdown-link">
            <UserPlusIcon size={16} />
            Create account
          </Link>
        </>}
      </div>
    </div>
  );
};

export default UserMenu;
