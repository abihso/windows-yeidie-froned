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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import DownOutlinedIcon from "@iconify-react/ant-design/down-outlined";
import { api, type User } from "../lib/api";
import { useState } from "react";
import { createPortal } from "react-dom";

export function ProfileMenu({
  user,
  onUserUpdated,
}: {
  user?: User | null;
  onUserUpdated?: (user: User) => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [specialties, setSpecialties] = useState(
    user?.specialties?.join(", ") ?? "",
  );
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsSuccess, setSettingsSuccess] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  const openSettings = () => {
    setFullName(user?.fullName ?? "");
    setBio(user?.bio ?? "");
    setSpecialties(user?.specialties?.join(", ") ?? "");
    setCurrentPassword("");
    setNewPassword("");
    setSettingsError("");
    setSettingsSuccess("");
    setSettingsOpen(true);
  };

  const saveSettings = async () => {
    if (!user) return;
    setSaving(true);
    setSettingsError("");
    setSettingsSuccess("");
    try {
      const updatedUser = await api.updateMe({
        fullName: fullName.trim(),
        bio: bio.trim(),
        ...(user.role === "counsellor"
          ? {
              specialties: specialties
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
            }
          : {}),
      });
      if (currentPassword || newPassword) {
        if (!currentPassword || !newPassword) {
          throw new Error(
            "Enter both password fields to change your password.",
          );
        }
        await api.changePassword(currentPassword, newPassword);
      }
      onUserUpdated?.(updatedUser);
      setCurrentPassword("");
      setNewPassword("");
      setSettingsSuccess("Settings saved successfully.");
    } catch (error) {
      setSettingsError(
        error instanceof Error ? error.message : "Unable to save settings.",
      );
    } finally {
      setSaving(false);
    }
  };
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
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              className={
                "bg-transparent hover:bg-[#e5e5e5e3] focus:bg-[#e5e5e5e3] py-9"
              }
            >
              <div className="flex justify-between items-center gap-4">
                <Avatar className={"h-10 w-10"}>
                  <AvatarImage src="https://github.com/shadcn.png" />
                  <AvatarFallback>
                    {user?.fullName?.slice(0, 2).toUpperCase() || "US"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-[#000057] font-extrabold ">
                    {user?.fullName || "User"}
                  </p>
                  <p className="text-xs text-left text-[#000057] font-extrabold">
                    {label}
                  </p>
                </div>
                <DownOutlinedIcon className="" />
              </div>
            </Button>
          }
        />
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
            <DropdownMenuItem onClick={openSettings}>
              Profile settings
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={loggingOut} onClick={handleLogout}>
            {loggingOut ? "Signing out..." : "Logout"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {settingsOpen &&
        createPortal(
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0A0332]/50 p-4">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-[#0A0332]">
                    Profile settings
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Update your profile and account security.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100"
                >
                  Close
                </button>
              </div>
              <div className="mt-5 space-y-3">
                <label className="block text-sm font-bold text-[#0A0332]">
                  Full name
                  <input
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-3 font-normal outline-none focus:border-[#1900FF]"
                  />
                </label>
                <label className="block text-sm font-bold text-[#0A0332]">
                  Bio
                  <textarea
                    value={bio}
                    onChange={(event) => setBio(event.target.value)}
                    maxLength={2000}
                    className="mt-1 min-h-24 w-full rounded-xl border border-slate-200 p-3 font-normal outline-none focus:border-[#1900FF]"
                  />
                </label>
                {user?.role === "counsellor" && (
                  <label className="block text-sm font-bold text-[#0A0332]">
                    Specialties
                    <input
                      value={specialties}
                      onChange={(event) => setSpecialties(event.target.value)}
                      placeholder="Career, anxiety, relationships"
                      className="mt-1 w-full rounded-xl border border-slate-200 p-3 font-normal outline-none focus:border-[#1900FF]"
                    />
                  </label>
                )}
                <div className="border-t border-slate-200 pt-4">
                  <p className="text-sm font-bold text-[#0A0332]">
                    Change password
                  </p>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(event) =>
                        setCurrentPassword(event.target.value)
                      }
                      placeholder="Current password"
                      className="rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-[#1900FF]"
                    />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      placeholder="New password"
                      className="rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-[#1900FF]"
                    />
                  </div>
                </div>
                {settingsError && (
                  <p className="text-sm text-red-600">{settingsError}</p>
                )}
                {settingsSuccess && (
                  <p className="text-sm text-green-700">{settingsSuccess}</p>
                )}
                <Button
                  type="button"
                  onClick={() => void saveSettings()}
                  disabled={saving}
                  className="w-full rounded-xl bg-[#1900FF] text-white hover:bg-[#1300c4]"
                >
                  {saving ? "Saving..." : "Save settings"}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
