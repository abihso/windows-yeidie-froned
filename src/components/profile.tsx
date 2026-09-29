import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import DownOutlinedIcon from "@iconify-react/ant-design/down-outlined";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api, normalizeMediaUrl, type User } from "../lib/api";

export function ProfileMenu({ user }: { user?: User | null }) {
  const [loggingOut, setLoggingOut] = useState(false);
  const label = user?.role
    ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
    : "User";

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await api.logout();
      window.location.href = "/";
    } catch (error) {
      console.error("Logout failed", error);
      window.location.href = "/";
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <DropdownMenu>
      <div className="flex items-center gap-1">
        <Link
          to="/profile"
          aria-label="Open profile"
          className="flex items-center gap-4 rounded-lg px-3 py-3 hover:bg-[#e5e5e5e3]"
        >
          <Avatar className="h-10 w-10">
            <AvatarImage
              src={normalizeMediaUrl(user?.avatarUrl)}
              alt="Profile picture"
            />
            <AvatarFallback>
              {user?.fullName?.slice(0, 2).toUpperCase() || "US"}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-[#000057] font-extrabold">
              {user?.fullName || "User"}
            </p>
            <p className="text-xs text-left text-[#000057] font-extrabold">
              {label}
            </p>
          </div>
        </Link>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Open account menu"
              title="Open account menu"
              className="bg-transparent hover:bg-[#e5e5e5e3] focus:bg-[#e5e5e5e3]"
            >
              <DownOutlinedIcon />
            </Button>
          }
        />
      </div>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => (window.location.href = "/home")}>
            Dashboard
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => (window.location.href = "/dashboard/messages")}
          >
            Messages
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => (window.location.href = "/dashboard/discovery")}
          >
            Discovery
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => (window.location.href = "/profile")}>
            Profile
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={loggingOut} onClick={handleLogout}>
          {loggingOut ? "Signing out..." : "Logout"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
