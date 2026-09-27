import { NavLink } from "react-router-dom";
import { Compass, Home, MessageCircle, Newspaper } from "lucide-react";

const items = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/dashboard/discovery", label: "Discover", icon: Compass },
  { to: "/dashboard/feeds", label: "Feeds", icon: Newspaper },
  { to: "/dashboard/messages", label: "Messages", icon: MessageCircle },
];

export function MobileBottomNav() {
  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `mobile-bottom-nav-link${isActive ? " is-active" : ""}`
          }
        >
          <Icon size={19} strokeWidth={2.2} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
