"use client";

import { useEffect, useRef, useState } from "react";
import { Field } from "@/components/form/Field";
import PasswordInput from "@/components/form/PasswordInput";
import PasswordRules, { meetsPasswordRules } from "@/components/form/PasswordRules";
import { api, setAccessToken } from "@/lib/api";
import { PROFILE_UPDATED } from "@/lib/events";
import { checkImage, IMAGE_TYPES } from "@/lib/media";
import { errorToast, successToast } from "@/lib/toast";
import { inputClass, primaryButton, secondaryButton, sectionTitle } from "@/lib/ui";
import { apiMessage } from "@/lib/validation/apiError";

type User = {
  name: string;
  email: string;
  avatarUrl: string | null;
  hasPassword: boolean;
};

const initialsOf = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

const sectionClass = "rounded-xl bg-panel p-5 ring-1 ring-line sm:p-6";

/* ---------- profile: photo and name ---------- */

const ProfileSection = ({ user, onSaved }: { user: User; onSaved: (user: User) => void }) => {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [saving, setSaving] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  // A new photo the user picked but hasn't uploaded yet.
  const [picked, setPicked] = useState<{ file: File; preview: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const previewUrl = useRef<string | null>(null); // so it can be freed on unmount

  const dropPicked = () => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current); // free the browser's copy
    previewUrl.current = null;
    setPicked(null);
  };

  useEffect(() => () => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
  }, []);

  const handlePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // picking the same file again still fires onChange
    if (!file) return;
    const problem = checkImage(file); // JPG, PNG or WebP, up to 10 MB: same as the backend
    if (problem) {
      errorToast(problem);
      return;
    }
    dropPicked();
    previewUrl.current = URL.createObjectURL(file);
    setPicked({ file, preview: previewUrl.current });
  };

  const handleUpload = async () => {
    if (!picked) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("avatar", picked.file);
      const response = await api.patch("/auth/change/avatar", form, { timeout: 60_000 });
      const avatarUrl: string | undefined = response.data.user?.avatarUrl ?? response.data.avatarUrl;
      if (avatarUrl) onSaved({ ...user, avatarUrl });
      setAvatarFailed(false);
      window.dispatchEvent(new Event(PROFILE_UPDATED)); // the sidebar shows the new photo
      successToast(response.data.message ?? "Photo updated");
      dropPicked();
    } catch (error) {
      errorToast(apiMessage(error));
    } finally {
      setUploading(false);
    }
  };

  const changed = name.trim() !== user.name;
  const canSave = name.trim().length >= 2 && changed && !saving;

  const cancel = () => {
    setEditing(false);
    setName(user.name);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      const response = await api.patch("/auth/profile", { name: name.trim() });
      onSaved({ ...user, ...response.data.user });
      window.dispatchEvent(new Event(PROFILE_UPDATED));
      successToast(response.data.message);
      setEditing(false);
    } catch (error) {
      errorToast(apiMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="profile-heading" className={`mt-8 ${sectionClass}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="profile-heading" className={sectionTitle}>
          Profile
        </h2>
        {!editing && (
          <button type="button" onClick={() => setEditing(true)} className={secondaryButton}>
            Edit
          </button>
        )}
      </div>

      <div className="mt-5 flex items-center gap-4">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-accent text-[20px] font-semibold text-white">
          {picked ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={picked.preview} alt="New profile photo preview" className="h-full w-full object-cover" />
          ) : user.avatarUrl && !avatarFailed ? (
            // Google photos refuse requests that send a Referer, hence no-referrer.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt=""
              referrerPolicy="no-referrer"
              onError={() => setAvatarFailed(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            initialsOf(user.name)
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-semibold">{user.name}</p>
          <p className="truncate text-[15px] text-muted">{user.email}</p>

          {/* Pick a photo → preview it → Upload sends it, Cancel puts the old one back. */}
          <input
            ref={fileInput}
            type="file"
            accept={IMAGE_TYPES.join(",")}
            onChange={handlePick}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
          />
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
            {picked ? (
              <>
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={uploading}
                  className="font-semibold text-accent hover:underline disabled:opacity-60"
                >
                  {uploading ? "Uploading…" : "Upload"}
                </button>
                <button
                  type="button"
                  onClick={dropPicked}
                  disabled={uploading}
                  className="font-medium text-muted hover:text-ink disabled:opacity-60"
                >
                  Cancel
                </button>
                <span className="text-muted" aria-live="polite">Preview of your new photo</span>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="font-medium text-accent hover:underline"
                >
                  {user.avatarUrl ? "Change photo" : "Upload photo"}
                </button>
                <span className="text-muted">JPG, PNG or WebP, up to 10 MB</span>
              </>
            )}
          </div>
        </div>
      </div>

      {editing && (
        <form onSubmit={handleSave} noValidate className="mt-6 space-y-5 border-t border-line pt-6">
          <Field id="profile-name" label="Name">
            <input
              id="profile-name"
              name="name"
              autoComplete="name"
              autoFocus
              maxLength={60}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClass}
            />
          </Field>


          <p className="text-[13px] text-muted">Your email is used to sign in and can&apos;t be changed here.</p>

          <div className="flex gap-2">
            <button type="submit" disabled={!canSave} className={primaryButton}>
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button type="button" onClick={cancel} disabled={saving} className={secondaryButton}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
};

/* ---------- password: change it, or create one for Google accounts ---------- */

const PasswordSection = ({ user, onCreated }: { user: User; onCreated: () => void }) => {
  const creating = !user.hasPassword; // Google-only accounts add their first password
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [saving, setSaving] = useState(false);

  const sameAsCurrent = !creating && next !== "" && next === current;
  const canSave = (creating || current !== "") && meetsPasswordRules(next) && !sameAsCurrent && !saving;

  const close = () => {
    setOpen(false);
    setCurrent("");
    setNext("");
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      const response = creating
        ? await api.post("/auth/password/set", { new_password: next })
        : await api.patch("/auth/change/password", { current_password: current, new_password: next });
      // The backend signs out other devices and gives this tab a fresh token.
      setAccessToken(response.data.accessToken);
      successToast(response.data.message);
      if (creating) onCreated();
      close();
    } catch (error) {
      errorToast(apiMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="password-heading" className={`mt-5 ${sectionClass}`}>
      <h2 id="password-heading" className={sectionTitle}>
        Password
      </h2>

      {!open ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-sm text-[15px] text-muted">
            {creating
              ? "You sign in with Google. Add a password to also sign in with your email."
              : "Change the password you use to sign in."}
          </p>
          <button type="button" onClick={() => setOpen(true)} className={secondaryButton}>
            {creating ? "Create a password" : "Change password"}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSave} noValidate className="mt-5 space-y-5">
          {!creating && (
            <Field id="current-password" label="Current password">
              <PasswordInput
                id="current-password"
                name="current-password"
                autoComplete="current-password"
                autoFocus
                value={current}
                onChange={(event) => setCurrent(event.target.value)}
              />
            </Field>
          )}

          <Field id="new-password" label={creating ? "Password" : "New password"}>
            <PasswordInput
              id="new-password"
              name="new-password"
              autoComplete="new-password"
              autoFocus={creating}
              aria-describedby="new-password-rules"
              value={next}
              onChange={(event) => setNext(event.target.value)}
            />
            <PasswordRules id="new-password-rules" value={next} />
            {sameAsCurrent && (
              <p className="mt-2 text-[13px] text-warn">Choose a password different from your current one.</p>
            )}
          </Field>

          <p className="text-[13px] text-muted">Other devices signed in to this account will be signed out.</p>

          <div className="flex gap-2">
            <button type="submit" disabled={!canSave} className={primaryButton}>
              {saving ? "Saving…" : creating ? "Create password" : "Save password"}
            </button>
            <button type="button" onClick={close} disabled={saving} className={secondaryButton}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
};

/* ---------- the page ---------- */

const Settings = () => {
  const [user, setUser] = useState<User | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api
      .get("/auth/me")
      .then((response) => setUser(response.data.user))
      .catch((error) => {
        setFailed(true);
        errorToast(apiMessage(error));
      });
  }, []);

  if (failed) {
    return (
      <main className="mx-auto w-full max-w-2xl px-5 py-16 text-center">
        <h1 className="text-[22px] font-semibold tracking-tight">Settings could not be loaded</h1>
        <p className="mt-2 text-[15px] text-muted">Check your connection and try again.</p>
        <button type="button" onClick={() => window.location.reload()} className={`mt-6 ${secondaryButton}`}>
          Try again
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-8 lg:py-12">
      <h1 className="font-display text-[36px] leading-tight lg:text-[44px]">Settings</h1>

      {user ? (
        <>
          <ProfileSection user={user} onSaved={setUser} />
          <PasswordSection user={user} onCreated={() => setUser({ ...user, hasPassword: true })} />
        </>
      ) : (
        <div aria-busy="true">
          <p className="sr-only">Loading settings…</p>
          <div className={`mt-8 h-44 animate-pulse ${sectionClass}`} />
          <div className={`mt-5 h-28 animate-pulse ${sectionClass}`} />
        </div>
      )}
    </main>
  );
};

export default Settings;
