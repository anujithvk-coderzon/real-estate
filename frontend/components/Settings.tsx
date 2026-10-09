"use client";

import { useEffect, useRef, useState } from "react";
import AgentReraForm from "@/components/AgentReraForm";
import { Field, Select } from "@/components/form/Field";
import PasswordInput from "@/components/form/PasswordInput";
import PasswordRules, { meetsPasswordRules } from "@/components/form/PasswordRules";
import { api, setAccessToken } from "@/lib/api";
import { PROFILE_UPDATED } from "@/lib/events";
import { labelOf, POSTED_BY } from "@/lib/listing";
import { checkImage, IMAGE_TYPES } from "@/lib/media";
import { errorToast, successToast } from "@/lib/toast";
import type { AuthUser, VerificationStatus } from "@/lib/types";
import { inputClass, primaryButton, secondaryButton } from "@/lib/ui";
import { apiMessage } from "@/lib/validation/apiError";

type User = AuthUser;

// Matches the backend: profileSchema allows up to 500 characters.
const MAX_DESCRIPTION = 500;

const initialsOf = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

/* ---------- small building blocks, so every section reads the same ---------- */

const Card = ({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) => {
  const id = `${title.toLowerCase().replace(/\s+/g, "-")}-heading`;
  return (
    <section aria-labelledby={id} className="overflow-hidden rounded-xl bg-panel ring-1 ring-line">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
        <div>
          <h2 id={id} className="text-[17px] font-semibold tracking-tight">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
        </div>
        {action}
      </div>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
};

// One line of a settings card: what it is, what it says, and what you can do about it.
const Row = ({ label, value, action }: { label: string; value: React.ReactNode; action?: React.ReactNode }) => (
  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0">
    <div className="min-w-0">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="mt-0.5 text-[15px]">{value}</dd>
    </div>
    {action}
  </div>
);

const textAction = "shrink-0 text-[14px] font-medium text-accent transition-colors hover:text-accent-hover";

/* ---------- profile: photo and name ---------- */

const ProfileCard = ({ user, onSaved }: { user: User; onSaved: (user: User) => void }) => {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [description, setDescription] = useState(user.description ?? "");
  const [accountType, setAccountType] = useState<string>(user.accountType);
  const [saving, setSaving] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  // A new photo, picked but not uploaded yet.
  const [picked, setPicked] = useState<{ file: File; preview: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const previewUrl = useRef<string | null>(null); // freed when it is replaced or the page closes

  const dropPicked = () => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = null;
    setPicked(null);
  };

  useEffect(
    () => () => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    },
    [],
  );

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

  const changed =
    name.trim() !== user.name ||
    description.trim() !== (user.description ?? "") ||
    accountType !== user.accountType;
  const canSave = name.trim().length >= 2 && description.length <= MAX_DESCRIPTION && changed && !saving;

  const cancel = () => {
    setEditing(false);
    setName(user.name);
    setDescription(user.description ?? "");
    setAccountType(user.accountType);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      const response = await api.patch("/auth/profile", {
        name: name.trim(),
        description: description.trim(),
        accountType,
      });
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
    <Card title="Profile" description="How you appear to buyers on your listings.">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        {/* ---------- photo ---------- */}
        <div className="shrink-0">
            <span
              className={`flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-accent text-[24px] font-semibold text-white ${
                picked ? "ring-2 ring-accent ring-offset-2" : ""
              }`}
            >
              {picked ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={picked.preview} alt="Preview of your new photo" className="h-full w-full object-cover" />
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

          {/* The real input stays hidden; the camera button opens it. */}
          <input
            ref={fileInput}
            type="file"
            accept={IMAGE_TYPES.join(",")}
            onChange={handlePick}
            hidden
            tabIndex={-1}
            aria-hidden="true"
          />

        </div>

        {/* ---------- name, email, role ---------- */}
        <div className="min-w-0 flex-1">
          {editing ? (
            <form onSubmit={handleSave} noValidate className="space-y-4">
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
              <Field
                id="profile-description"
                label="About you"
                optional
                hint="Shown on your profile. Who you are, the areas you cover, how long you have been doing this."
              >
                <textarea
                  id="profile-description"
                  name="description"
                  rows={4}
                  maxLength={MAX_DESCRIPTION}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className={`${inputClass} resize-y`}
                />
                <p className="mt-1 text-right text-[12px] text-muted" aria-live="polite">
                  {description.length} / {MAX_DESCRIPTION}
                </p>
              </Field>

              <Field
                id="profile-account-type"
                label="You usually list as"
                hint="Pre-selects the choice when you list a property. Builders can also add projects."
              >
                <Select
                  id="profile-account-type"
                  value={accountType}
                  options={POSTED_BY}
                  onChange={(event) => setAccountType(event.target.value)}
                />
              </Field>

              <div className="flex gap-2">
                <button type="submit" disabled={!canSave} className={primaryButton}>
                  {saving ? "Saving…" : "Save"}
                </button>
                <button type="button" onClick={cancel} disabled={saving} className={secondaryButton}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <dl className="divide-y divide-line">
              <Row
                label="Name"
                value={user.name}
                action={
                  <button type="button" onClick={() => setEditing(true)} className={textAction}>
                    Edit
                  </button>
                }
              />
              <Row
                label="Email"
                value={user.email}
                action={<span className="shrink-0 text-[13px] text-muted">Used to sign in</span>}
              />
              <Row
                label="About you"
                value={
                  user.description ? (
                    <span className="block whitespace-pre-line text-[14px] leading-relaxed">{user.description}</span>
                  ) : (
                    <span className="text-muted">Not added yet</span>
                  )
                }
                action={
                  <button type="button" onClick={() => setEditing(true)} className={textAction}>
                    {user.description ? "Edit" : "Add"}
                  </button>
                }
              />
              <Row
                label="Photo"
                value={
                  <span className="text-muted">
                    {user.avatarUrl ? "Added" : "Not added"} · JPG, PNG or WebP, up to 10 MB
                  </span>
                }
                action={
                  <button type="button" onClick={() => fileInput.current?.click()} className={textAction}>
                    {user.avatarUrl ? "Change" : "Upload"}
                  </button>
                }
              />
              <Row
                label="You usually list as"
                value={labelOf(user.accountType) || "Owner"}
                action={
                  <button type="button" onClick={() => setEditing(true)} className={textAction}>
                    Change
                  </button>
                }
              />
            </dl>
          )}
        </div>
      </div>

      {/* Picking a photo changes nothing until it is uploaded, so say so plainly
          and put the action where the eye already is. */}
      {picked && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-accent-soft px-4 py-3">
          <p className="text-[14px] font-medium text-accent" aria-live="polite">
            New photo selected. It isn&apos;t saved yet.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleUpload} disabled={uploading} className={primaryButton}>
              {uploading ? "Uploading…" : "Upload photo"}
            </button>
            <button
              type="button"
              onClick={dropPicked}
              disabled={uploading}
              className={`bg-panel ${secondaryButton}`}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </Card>
  );
};

/* ---------- RERA registration, for brokers, dealers and builders ---------- */

const STATUS_DISPLAY: Record<VerificationStatus, { text: string; className: string; help: string }> = {
  NONE: {
    text: "Not added",
    className: "bg-ground text-muted",
    help: "Agents need a registration number to list a property for sale. Rentals and PG don't.",
  },
  PENDING: {
    text: "Awaiting check",
    className: "bg-warn/10 text-warn",
    help: "Your number is shown on your listings as provided by you, until someone checks it against the state register.",
  },
  VERIFIED: {
    text: "Verified",
    className: "bg-accent-soft text-accent",
    help: "Checked against the state register. Your listings show a verified badge.",
  },
  REVOKED: {
    text: "Removed by the registry",
    className: "bg-danger/10 text-danger",
    help: "This registration is no longer valid. Add a current one to keep listing properties for sale.",
  },
};

const ReraCard = ({ user, onSaved }: { user: User; onSaved: (status: VerificationStatus) => void }) => {
  const [editing, setEditing] = useState(false);
  const status = STATUS_DISPLAY[user.agentReraStatus] ?? STATUS_DISPLAY.NONE;
  const hasNumber = Boolean(user.agentReraNumber);

  return (
    <Card
      title="RERA registration"
      description="Shown on your sale listings so buyers can check it."
      action={
        !editing && (
          <button type="button" onClick={() => setEditing(true)} className={textAction}>
            {hasNumber || user.agentReraStatus !== "NONE" ? "Update" : "Add number"}
          </button>
        )
      }
    >
      {editing ? (
        <AgentReraForm
          variant="inline"
          revoked={user.agentReraStatus === "REVOKED"}
          current={user.agentReraNumber ?? null}
          onSaved={() => {
            onSaved("PENDING");
            setEditing(false);
          }}
          onBack={() => setEditing(false)}
        />
      ) : (
        <dl className="divide-y divide-line">
          <Row
            label="Status"
            value={
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-[13px] font-medium ${status.className}`}>
                {status.text}
              </span>
            }
          />
          {user.agentReraNumber && (
            <Row label="Registration number" value={<span className="font-mono">{user.agentReraNumber}</span>} />
          )}
          {user.agentReraState && <Row label="State" value={user.agentReraState} />}
          <div className="pt-3 text-[13px] leading-snug text-muted">{status.help}</div>
        </dl>
      )}
    </Card>
  );
};

/* ---------- password: change it, or create one for Google accounts ---------- */

const PasswordCard = ({ user, onCreated }: { user: User; onCreated: () => void }) => {
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
    <Card
      title="Password"
      description={creating ? "You sign in with Google." : "Used when you sign in with your email."}
      action={
        !open && (
          <button type="button" onClick={() => setOpen(true)} className={textAction}>
            {creating ? "Create a password" : "Change"}
          </button>
        )
      }
    >
      {open ? (
        <form onSubmit={handleSave} noValidate className="space-y-5">
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
      ) : (
        <dl className="divide-y divide-line">
          <Row
            label="Password"
            value={creating ? "Not set — add one to sign in with your email too" : "••••••••"}
          />
        </dl>
      )}
    </Card>
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

  // Owners never list on anyone's behalf, so the registration card is not for them.
  const showRera = user && user.accountType !== "OWNER";

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-8 lg:py-12">
      <header>
        <h1 className="font-display text-[34px] leading-tight lg:text-[40px]">Settings</h1>
        <p className="mt-1 text-[15px] text-muted">Your account and how you appear to buyers.</p>
      </header>

      {user ? (
        <div className="mt-8 space-y-5">
          <ProfileCard user={user} onSaved={setUser} />
          {showRera && (
            <ReraCard user={user} onSaved={(agentReraStatus) => setUser({ ...user, agentReraStatus })} />
          )}
          <PasswordCard user={user} onCreated={() => setUser({ ...user, hasPassword: true })} />
        </div>
      ) : (
        <div className="mt-8 space-y-5" aria-busy="true">
          <p className="sr-only">Loading settings…</p>
          <div className="h-52 animate-pulse rounded-xl bg-panel ring-1 ring-line" />
          <div className="h-32 animate-pulse rounded-xl bg-panel ring-1 ring-line" />
        </div>
      )}
    </main>
  );
};

export default Settings;
