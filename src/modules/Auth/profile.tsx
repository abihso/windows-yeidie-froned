import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Edit, LoaderCircle, Save, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, normalizeMediaUrl, type User } from "../../lib/api";

type ProfileDraft = {
  firstName: string;
  middleName: string;
  lastName: string;
};

type ProfileSection = "profile" | "security";

const emptyDraft: ProfileDraft = {
  firstName: "",
  middleName: "",
  lastName: "",
};

function toDraft(user: User): ProfileDraft {
  const parts = user.fullName.trim().split(/\s+/).filter(Boolean);
  const firstName = parts.shift() ?? "";
  const lastName = parts.length > 1 ? (parts.pop() ?? "") : "";
  return {
    firstName,
    middleName: parts.join(" "),
    lastName,
  };
}

const fieldClassName =
  "mt-1 w-full rounded-lg border px-1 py-3 text-[10px] font-normal text-[#7A7B7B] disabled:bg-gray-50 disabled:opacity-70";

function Profile() {
  const [user, setUser] = useState<User | null>(null);
  const [draft, setDraft] = useState<ProfileDraft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeSection, setActiveSection] = useState<ProfileSection>("profile");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [securityError, setSecurityError] = useState("");
  const [securitySuccess, setSecuritySuccess] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;

    api
      .me()
      .then((currentUser) => {
        if (cancelled) return;
        setUser(currentUser);
        setDraft(toDraft(currentUser));
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load your profile.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const beginEditing = () => {
    if (!user) return;
    setDraft(toDraft(user));
    setError("");
    setSuccess("");
    setEditing(true);
  };

  const cancelEditing = () => {
    if (user) setDraft(toDraft(user));
    setEditing(false);
    setError("");
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || saving) return;

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const updatedUser = await api.updateMe({
        fullName: [draft.firstName, draft.middleName, draft.lastName]
          .map((part) => part.trim())
          .filter(Boolean)
          .join(" "),
      });
      setUser(updatedUser);
      setDraft(toDraft(updatedUser));
      setEditing(false);
      setSuccess("Profile updated.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to save your profile.",
      );
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (changingPassword) return;
    setSecurityError("");
    setSecuritySuccess("");
    if (newPassword !== confirmPassword) {
      setSecurityError("The new passwords do not match.");
      return;
    }

    setChangingPassword(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSecuritySuccess("Password updated successfully.");
    } catch (requestError) {
      setSecurityError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update your password.",
      );
    } finally {
      setChangingPassword(false);
    }
  };

  const uploadProfilePicture = async (event: ChangeEvent<HTMLInputElement>) => {
    const image = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!image) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(image.type)) {
      setError("Choose a JPEG, PNG, WebP, or GIF image.");
      return;
    }
    if (image.size > 5 * 1024 * 1024) {
      setError("Choose an image smaller than 5 MB.");
      return;
    }

    const preview = URL.createObjectURL(image);
    setAvatarPreview(preview);
    setAvatarUploading(true);
    setError("");
    setSuccess("");
    try {
      const updatedUser = await api.uploadAvatar(image);
      setUser(updatedUser);
      setSuccess("Profile picture updated.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to upload your profile picture.",
      );
    } finally {
      URL.revokeObjectURL(preview);
      setAvatarPreview("");
      setAvatarUploading(false);
    }
  };

  const deleteAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (deletingAccount || deleteConfirmation !== "DELETE") return;

    setDeletingAccount(true);
    setDeleteError("");
    try {
      await api.deleteAccount(deletePassword);
      window.location.href = "/";
    } catch (requestError) {
      setDeleteError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to delete your account.",
      );
      setDeletingAccount(false);
    }
  };

  const initials = user?.fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const roleLabel = user?.role
    ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
    : "";

  return (
    <div className="min-h-screen relative flex justify-center py-8">
      <div className="w-[80%] grid grid-cols-12 gap-4 items-stretch">
        <div className="col-span-2 border rounded-3xl p-4 flex flex-col justify-between h-full shadow-sm bg-white">
          <div className="flex flex-col gap-5">
            <button
              type="button"
              onClick={() => setActiveSection("profile")}
              className={`text-left text-xs font-bold w-fit px-2 py-1 rounded-lg ${activeSection === "profile" ? "text-[#2F88FF] bg-[#f8eede60]" : "text-[#7A7B7B]"}`}
            >
              My Profile
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveSection("security");
                setSecurityError("");
                setSecuritySuccess("");
              }}
              className={`text-left text-xs font-bold w-fit px-2 py-1 rounded-lg ${activeSection === "security" ? "text-[#2F88FF] bg-[#f8eede60]" : "text-[#7A7B7B]"}`}
            >
              Security
            </button>
            <p className="text-xs font-bold text-[#7A7B7B]">Notification</p>
            <p className="text-xs font-bold text-[#7A7B7B]">
              Group and Members
            </p>
            <p className="text-xs font-bold text-[#7A7B7B]">Billing</p>
          </div>
          <button
            type="button"
            disabled={!user || loading}
            onClick={() => {
              setDeletePassword("");
              setDeleteConfirmation("");
              setDeleteError("");
              setDeleteDialogOpen(true);
            }}
            className="text-left text-xs font-bold text-red-600 disabled:opacity-50"
          >
            Delete Account
          </button>
        </div>

        <div className="col-span-10 font-extrabold flex flex-col justify-between h-full">
          <div>
            <div className="flex justify-between items-center">
              <p>{activeSection === "security" ? "Security" : "My Profile"}</p>
              {activeSection === "profile" && user && !editing && (
                <Button type="button" onClick={beginEditing}>
                  Edit <Edit className="h-3 w-3" />
                </Button>
              )}
            </div>

            {error && !user && (
              <p role="alert" className="mt-3 text-sm font-normal text-red-600">
                {error} <Link to="/">Return to sign in</Link>
              </p>
            )}

            <div className="h-24 flex gap-2 items-center px-7 rounded-2xl mt-4 border border-[#D5E7FF] bg-[#EBF3FF] shadow-sm">
              <div className="relative">
                <Avatar className="h-18 w-18 shrink-0">
                  <AvatarImage
                    src={avatarPreview || normalizeMediaUrl(user?.avatarUrl)}
                    alt="Profile picture"
                  />
                  <AvatarFallback>{initials || "U"}</AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  aria-label="Change profile picture"
                  title="Change profile picture"
                  disabled={!user || loading || avatarUploading}
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute flex h-6 w-6 items-center justify-center rounded-md bg-[#010DE2] text-white bottom-1 -right-1 disabled:opacity-60 shadow-sm"
                >
                  {avatarUploading ? (
                    <LoaderCircle className="h-3 w-3 animate-spin" />
                  ) : (
                    <Edit className="h-3 w-3" />
                  )}
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  onChange={uploadProfilePicture}
                  tabIndex={-1}
                />
              </div>
              <div className="h-full pt-3 min-w-0">
                <p className="font-bold truncate">
                  {loading ? "Loading profile..." : user?.fullName || "User"}
                </p>
                <p className="text-[10px] font-bold text-[#7A7B7B] truncate">
                  {user?.email ?? ""}
                </p>
                <p className="text-[10px] font-bold text-[#7A7B7B]">
                  {roleLabel}
                </p>
              </div>
            </div>

            {activeSection === "profile" ? (
              <form onSubmit={saveProfile}>
                <div className="p-4 border rounded-2xl mt-4 shadow-sm bg-white">
                  <div className="flex justify-between items-center mt-4">
                    <p>Personal Information</p>
                    {editing && (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={cancelEditing}
                          disabled={saving}
                        >
                          <X className="h-3 w-3" /> Cancel
                        </Button>
                        <Button type="submit" disabled={saving}>
                          {saving ? (
                            <LoaderCircle className="h-3 w-3 animate-spin" />
                          ) : (
                            <Save className="h-3 w-3" />
                          )}
                          {saving ? "Saving..." : "Save"}
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-12 gap-4 mt-4">
                    <label className="col-span-4 text-[10px] font-bold text-[#7A7B7B]">
                      First Name
                      <input
                        required
                        value={draft.firstName}
                        disabled={!editing || saving}
                        onChange={(event) =>
                          setDraft({ ...draft, firstName: event.target.value })
                        }
                        className={fieldClassName}
                      />
                    </label>
                    <label className="col-span-4 text-[10px] font-bold text-[#7A7B7B]">
                      Middle Name
                      <input
                        value={draft.middleName}
                        disabled={!editing || saving}
                        onChange={(event) =>
                          setDraft({ ...draft, middleName: event.target.value })
                        }
                        className={fieldClassName}
                      />
                    </label>
                    <label className="col-span-4 text-[10px] font-bold text-[#7A7B7B]">
                      Last Name
                      <input
                        value={draft.lastName}
                        disabled={!editing || saving}
                        onChange={(event) =>
                          setDraft({ ...draft, lastName: event.target.value })
                        }
                        className={fieldClassName}
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-12 gap-4 mt-4">
                    <label className="col-span-6 text-[10px] font-bold text-[#7A7B7B]">
                      Date of birth
                      <input
                        disabled
                        placeholder="Not available"
                        className={fieldClassName}
                      />
                    </label>
                    <label className="col-span-3 text-[10px] font-bold text-[#7A7B7B]">
                      Phone Number
                      <input
                        disabled
                        placeholder="Not available"
                        className={fieldClassName}
                      />
                    </label>
                    <label className="col-span-3 text-[10px] font-bold text-[#7A7B7B]">
                      Other Number
                      <input
                        disabled
                        placeholder="Not available"
                        className={fieldClassName}
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-12 gap-4 mt-4">
                    <label className="col-span-12 text-[10px] font-bold text-[#7A7B7B]">
                      Email
                      <input
                        type="email"
                        value={user?.email ?? ""}
                        readOnly
                        placeholder={loading ? "Loading..." : ""}
                        className={fieldClassName}
                      />
                    </label>
                  </div>
                  {(error || success) && user && (
                    <p
                      role={error ? "alert" : "status"}
                      className={`mt-3 text-xs font-semibold ${error ? "text-red-600" : "text-green-700"}`}
                    >
                      {error || success}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-12 gap-4 mt-4">
                  <div className="col-span-6 border rounded-2xl p-4 shadow-sm bg-white">
                    <div className="flex justify-between items-center">
                      <p>Personal Address</p>
                      <Button
                        type="button"
                        disabled
                        className="text-xs font-bold flex items-center gap-1 text-[#2F88FF]"
                      >
                        Edit <Edit className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-12 gap-4 mt-2">
                      <label className="col-span-6 text-[10px] font-bold text-[#7A7B7B]">
                        Country
                        <input
                          disabled
                          placeholder="Not available"
                          className={fieldClassName}
                        />
                      </label>
                      <label className="col-span-6 text-[10px] font-bold text-[#7A7B7B]">
                        City/State
                        <input
                          disabled
                          placeholder="Not available"
                          className={fieldClassName}
                        />
                      </label>
                    </div>
                    <div className="grid grid-cols-12 gap-4 mt-4">
                      <label className="col-span-6 text-[10px] font-bold text-[#7A7B7B]">
                        Address 1
                        <input
                          disabled
                          placeholder="Not available"
                          className={fieldClassName}
                        />
                      </label>
                      <label className="col-span-6 text-[10px] font-bold text-[#7A7B7B]">
                        Address 2
                        <input
                          disabled
                          placeholder="Not available"
                          className={fieldClassName}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="col-span-6 border rounded-2xl p-4 shadow-sm bg-white">
                    <div className="flex justify-between items-center">
                      <p>Parent / Guardian</p>
                      <Button
                        type="button"
                        disabled
                        className="text-xs font-bold flex items-center gap-1 text-[#2F88FF]"
                      >
                        Edit <Edit className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-12 gap-4 mt-2">
                      <label className="col-span-6 text-[10px] font-bold text-[#7A7B7B]">
                        Name
                        <input
                          disabled
                          placeholder="Not available"
                          className={fieldClassName}
                        />
                      </label>
                      <label className="col-span-6 text-[10px] font-bold text-[#7A7B7B]">
                        Relationship
                        <input
                          disabled
                          placeholder="Not available"
                          className={fieldClassName}
                        />
                      </label>
                    </div>
                    <div className="grid grid-cols-12 gap-4 mt-4">
                      <label className="col-span-6 text-[10px] font-bold text-[#7A7B7B]">
                        Phone Number
                        <input
                          disabled
                          placeholder="Not available"
                          className={fieldClassName}
                        />
                      </label>
                      <label className="col-span-6 text-[10px] font-bold text-[#7A7B7B]">
                        Other Number
                        <input
                          disabled
                          placeholder="Not available"
                          className={fieldClassName}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </form>
            ) : (
              <section className="p-4 border rounded-2xl mt-4 shadow-sm bg-white">
                <h2 className="font-bold">Change Password</h2>
                <p className="mt-1 text-xs font-normal text-[#7A7B7B]">
                  Enter your current password and choose a new one.
                </p>
                <form onSubmit={changePassword} className="mt-4">
                  <div className="grid grid-cols-12 gap-4">
                    <label className="col-span-12 text-[10px] font-bold text-[#7A7B7B]">
                      Current Password
                      <input
                        type="password"
                        autoComplete="current-password"
                        required
                        value={currentPassword}
                        disabled={changingPassword}
                        onChange={(event) =>
                          setCurrentPassword(event.target.value)
                        }
                        className={fieldClassName}
                      />
                    </label>
                    <label className="col-span-6 text-[10px] font-bold text-[#7A7B7B]">
                      New Password
                      <input
                        type="password"
                        autoComplete="new-password"
                        minLength={10}
                        maxLength={72}
                        required
                        value={newPassword}
                        disabled={changingPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        className={fieldClassName}
                      />
                    </label>
                    <label className="col-span-6 text-[10px] font-bold text-[#7A7B7B]">
                      Confirm New Password
                      <input
                        type="password"
                        autoComplete="new-password"
                        minLength={10}
                        maxLength={72}
                        required
                        value={confirmPassword}
                        disabled={changingPassword}
                        onChange={(event) =>
                          setConfirmPassword(event.target.value)
                        }
                        className={fieldClassName}
                      />
                    </label>
                  </div>
                  {(securityError || securitySuccess) && (
                    <p
                      role={securityError ? "alert" : "status"}
                      className={`mt-3 text-xs font-semibold ${securityError ? "text-red-600" : "text-green-700"}`}
                    >
                      {securityError || securitySuccess}
                    </p>
                  )}
                  <Button
                    type="submit"
                    disabled={changingPassword}
                    className="mt-4"
                  >
                    {changingPassword ? (
                      <LoaderCircle className="h-3 w-3 animate-spin" />
                    ) : (
                      <Save className="h-3 w-3" />
                    )}
                    {changingPassword ? "Updating..." : "Update Password"}
                  </Button>
                </form>
              </section>
            )}
          </div>
        </div>
      </div>

      {deleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-2xl"
          >
            <h2 id="delete-account-title" className="font-bold text-red-700">
              Delete Account
            </h2>
            <p className="mt-2 text-sm font-normal text-[#7A7B7B]">
              This permanently removes your sign-in access and anonymizes your
              profile. Existing appointments and shared messages are retained
              under “Deleted user”.
            </p>
            <form onSubmit={deleteAccount} className="mt-4">
              <label className="block text-xs font-bold text-[#7A7B7B]">
                Current Password
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  minLength={10}
                  value={deletePassword}
                  disabled={deletingAccount}
                  onChange={(event) => setDeletePassword(event.target.value)}
                  className={fieldClassName}
                />
              </label>
              <label className="mt-4 block text-xs font-bold text-[#7A7B7B]">
                Type DELETE to confirm
                <input
                  required
                  value={deleteConfirmation}
                  disabled={deletingAccount}
                  onChange={(event) =>
                    setDeleteConfirmation(event.target.value)
                  }
                  className={fieldClassName}
                />
              </label>
              {deleteError && (
                <p role="alert" className="mt-3 text-xs text-red-600">
                  {deleteError}
                </p>
              )}
              <div className="mt-5 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDeleteDialogOpen(false)}
                  disabled={deletingAccount}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={deletingAccount || deleteConfirmation !== "DELETE"}
                >
                  {deletingAccount ? "Deleting..." : "Delete account"}
                </Button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default Profile;
