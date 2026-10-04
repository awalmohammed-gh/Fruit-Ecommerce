import type { ReactNode } from "react";
import { Link } from "react-router-dom";

// A button link set by the admin: a store page ("/products"), a home page section ("#categories")
// or another website (opens in a new tab).
export default function ContentLink({ to, className, children }: { to: string; className?: string; children: ReactNode }) {
  if (to.startsWith("/")) return <Link to={to} className={className}>{children}</Link>;
  if (to.startsWith("#")) return <a href={to} className={className}>{children}</a>;
  return <a href={to} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>;
}
