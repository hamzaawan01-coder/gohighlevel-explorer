import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Building2, KeyRound, Loader2, Mail, Trash2, Upload, User } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { SettingsShell } from "@/components/SettingsNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useTenancy } from "@/lib/tenancy";
import { initials } from "@/lib/initials";
import {
  AVATAR_BUCKET,
  BRANDING_BUCKET,
  changePassword,
  fetchCompanyProfile,
  fetchMyProfile,
  removeAvatar,
  removeCompanyLogo,
  requestEmailChange,
  resolveImageSrc,
  updateCompanyProfile,
  updateMyProfile,
  uploadAvatar,
  uploadCompanyLogo,
  validateImage,
  type CompanyProfile,
  type MyProfile,
} from "@/lib/profile";

export const Route = createFileRoute("/_authenticated/settings/profile")({
  head: () => ({
    meta: [
      { title: "Profile & company — Lead Convert" },
      {
        name: "description",
        content:
          "Update your profile picture, name and contact details, your company logo and address, and change your email or password.",
      },
      { property: "og:title", content: "Profile & company settings" },
      {
        property: "og:description",
        content: "Manage your personal profile, company branding, email address and password.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfileSettingsPage,
});

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card p-4 md:p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="rounded-md bg-primary/10 p-2 text-primary">
          <Icon className="size-4" />
        </span>
        <div>
          <h2 className="font-display text-sm font-bold">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function ProfileSettingsPage() {
  const currentSubAccountId = useTenancy((s) => s.currentSubAccountId);

  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [uploading, setUploading] = useState<"avatar" | "logo" | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);

  const avatarInput = useRef<HTMLInputElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase.auth.getUser();
        const uid = data.user?.id ?? null;
        if (!alive) return;
        setUserId(uid);
        setEmail(data.user?.email ?? "");
        if (uid) {
          const p = await fetchMyProfile(uid);
          if (!alive) return;
          setProfile(p);
          setAvatarSrc(await resolveImageSrc(AVATAR_BUCKET, p.avatar_url));
        }
        if (currentSubAccountId) {
          const c = await fetchCompanyProfile(currentSubAccountId);
          if (!alive) return;
          setCompany(c);
          setLogoSrc(await resolveImageSrc(BRANDING_BUCKET, c?.logo_url));
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not load your profile.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [currentSubAccountId]);

  async function pickAvatar(file: File) {
    if (!userId) return;
    const bad = validateImage(file);
    if (bad) return toast.error(bad);
    setUploading("avatar");
    try {
      const path = await uploadAvatar(userId, file);
      setProfile((p) => (p ? { ...p, avatar_url: path } : p));
      setAvatarSrc(await resolveImageSrc(AVATAR_BUCKET, path));
      toast.success("Profile picture updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(null);
    }
  }

  async function pickLogo(file: File) {
    if (!currentSubAccountId) return;
    const bad = validateImage(file);
    if (bad) return toast.error(bad);
    setUploading("logo");
    try {
      const path = await uploadCompanyLogo(currentSubAccountId, file);
      setCompany((c) => (c ? { ...c, logo_url: path } : c));
      setLogoSrc(await resolveImageSrc(BRANDING_BUCKET, path));
      toast.success("Company logo updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(null);
    }
  }

  async function saveProfile() {
    if (!userId || !profile) return;
    setSavingProfile(true);
    try {
      const saved = await updateMyProfile(userId, {
        full_name: profile.full_name?.trim() || null,
        phone: profile.phone?.trim() || null,
        job_title: profile.job_title?.trim() || null,
        timezone: profile.timezone?.trim() || null,
        signature: profile.signature?.trim() || null,
      });
      setProfile(saved);
      toast.success("Profile saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save your profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveCompany() {
    if (!currentSubAccountId || !company) return;
    setSavingCompany(true);
    try {
      const saved = await updateCompanyProfile(currentSubAccountId, {
        name: company.name.trim() || "Untitled workspace",
        industry: company.industry?.trim() || null,
        website: company.website?.trim() || null,
        support_email: company.support_email?.trim() || null,
        phone: company.phone?.trim() || null,
        address_line1: company.address_line1?.trim() || null,
        address_line2: company.address_line2?.trim() || null,
        city: company.city?.trim() || null,
        postcode: company.postcode?.trim() || null,
        country: company.country?.trim() || null,
        company_number: company.company_number?.trim() || null,
        vat_number: company.vat_number?.trim() || null,
      });
      setCompany(saved);
      toast.success("Company details saved.");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Could not save company details — you may not have permission for this workspace.",
      );
    } finally {
      setSavingCompany(false);
    }
  }

  async function submitEmailChange() {
    const next = newEmail.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(next)) return toast.error("Enter a valid email address.");
    setEmailBusy(true);
    try {
      await requestEmailChange(next);
      toast.success(`Confirmation sent to ${next}. Click the link to finish the change.`);
      setNewEmail("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start the email change.");
    } finally {
      setEmailBusy(false);
    }
  }

  async function submitPasswordChange() {
    if (newPassword.length < 8) return toast.error("New password must be at least 8 characters.");
    if (newPassword !== confirmPassword) return toast.error("New passwords do not match.");
    if (!email) return toast.error("No email on this account.");
    setPasswordBusy(true);
    try {
      await changePassword(email, currentPassword, newPassword);
      toast.success("Password changed.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change your password.");
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="Profile & company"
        description="Your personal details and picture, your company branding and address, plus login email and password."
        crumbs={[{ label: "Settings" }, { label: "Profile" }]}
      />
      <PageBody>
        <SettingsShell>

        {loading ? (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading your profile…
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {/* Personal profile */}
            <Section
              icon={User}
              title="Your profile"
              description="Shown on assignments, notes and outgoing messages."
            >
              <div className="mb-4 flex items-center gap-4">
                <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-secondary text-sm font-semibold">
                  {avatarSrc ? (
                    <img src={avatarSrc} alt="Your profile picture" className="size-full object-cover" />
                  ) : (
                    <span>{initials(profile?.full_name || email || "?")}</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={avatarInput}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) void pickAvatar(f);
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={uploading === "avatar"}
                    onClick={() => avatarInput.current?.click()}
                  >
                    {uploading === "avatar" ? (
                      <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    ) : (
                      <Upload className="mr-1.5 size-3.5" />
                    )}
                    Upload picture
                  </Button>
                  {profile?.avatar_url ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        if (!userId) return;
                        await removeAvatar(userId, profile.avatar_url);
                        setProfile({ ...profile, avatar_url: null });
                        setAvatarSrc(null);
                        toast.success("Profile picture removed.");
                      }}
                    >
                      <Trash2 className="mr-1.5 size-3.5" /> Remove
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="full_name">Full name</Label>
                  <Input
                    id="full_name"
                    value={profile?.full_name ?? ""}
                    onChange={(e) => setProfile((p) => (p ? { ...p, full_name: e.target.value } : p))}
                    placeholder="Jane Smith"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="job_title">Job title</Label>
                  <Input
                    id="job_title"
                    value={profile?.job_title ?? ""}
                    onChange={(e) => setProfile((p) => (p ? { ...p, job_title: e.target.value } : p))}
                    placeholder="Account manager"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="user_phone">Phone</Label>
                  <Input
                    id="user_phone"
                    value={profile?.phone ?? ""}
                    onChange={(e) => setProfile((p) => (p ? { ...p, phone: e.target.value } : p))}
                    placeholder="+44 7700 900123"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="user_tz">Timezone</Label>
                  <Input
                    id="user_tz"
                    value={profile?.timezone ?? ""}
                    onChange={(e) => setProfile((p) => (p ? { ...p, timezone: e.target.value } : p))}
                    placeholder="Europe/London"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="signature">Email signature</Label>
                  <Textarea
                    id="signature"
                    rows={3}
                    value={profile?.signature ?? ""}
                    onChange={(e) => setProfile((p) => (p ? { ...p, signature: e.target.value } : p))}
                    placeholder={"Jane Smith\nAccount manager, Click Away Finance"}
                  />
                </div>
              </div>
              <div className="mt-4">
                <Button size="sm" onClick={saveProfile} disabled={savingProfile}>
                  {savingProfile ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
                  Save profile
                </Button>
              </div>
            </Section>

            {/* Company */}
            <Section
              icon={Building2}
              title="Company details"
              description="Used on invoices, booking pages and customer emails for the current workspace."
            >
              {!currentSubAccountId || !company ? (
                <p className="text-sm text-muted-foreground">
                  Pick a workspace from the switcher at the top of the sidebar to edit company details.
                </p>
              ) : (
                <>
                  <div className="mb-4 flex items-center gap-4">
                    <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-secondary text-xs text-muted-foreground">
                      {logoSrc ? (
                        <img src={logoSrc} alt="Company logo" className="size-full object-contain p-1" />
                      ) : (
                        <span>No logo</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <input
                        ref={logoInput}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (f) void pickLogo(f);
                        }}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={uploading === "logo"}
                        onClick={() => logoInput.current?.click()}
                      >
                        {uploading === "logo" ? (
                          <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                        ) : (
                          <Upload className="mr-1.5 size-3.5" />
                        )}
                        Upload logo
                      </Button>
                      {company.logo_url ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            await removeCompanyLogo(currentSubAccountId, company.logo_url);
                            setCompany({ ...company, logo_url: null });
                            setLogoSrc(null);
                            toast.success("Logo removed.");
                          }}
                        >
                          <Trash2 className="mr-1.5 size-3.5" /> Remove
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="co_name">Company name</Label>
                      <Input
                        id="co_name"
                        value={company.name}
                        onChange={(e) => setCompany({ ...company, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="co_industry">Industry</Label>
                      <Input
                        id="co_industry"
                        value={company.industry ?? ""}
                        onChange={(e) => setCompany({ ...company, industry: e.target.value })}
                        placeholder="Financial services"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="co_website">Website</Label>
                      <Input
                        id="co_website"
                        value={company.website ?? ""}
                        onChange={(e) => setCompany({ ...company, website: e.target.value })}
                        placeholder="https://example.com"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="co_email">Support email</Label>
                      <Input
                        id="co_email"
                        value={company.support_email ?? ""}
                        onChange={(e) => setCompany({ ...company, support_email: e.target.value })}
                        placeholder="hello@example.com"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="co_phone">Company phone</Label>
                      <Input
                        id="co_phone"
                        value={company.phone ?? ""}
                        onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                        placeholder="+44 20 7946 0000"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="co_tz">Workspace timezone</Label>
                      <Input
                        id="co_tz"
                        value={company.timezone ?? ""}
                        onChange={(e) => setCompany({ ...company, timezone: e.target.value })}
                        placeholder="Europe/London"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="co_addr1">Address line 1</Label>
                      <Input
                        id="co_addr1"
                        value={company.address_line1 ?? ""}
                        onChange={(e) => setCompany({ ...company, address_line1: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="co_addr2">Address line 2</Label>
                      <Input
                        id="co_addr2"
                        value={company.address_line2 ?? ""}
                        onChange={(e) => setCompany({ ...company, address_line2: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="co_city">City</Label>
                      <Input
                        id="co_city"
                        value={company.city ?? ""}
                        onChange={(e) => setCompany({ ...company, city: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="co_post">Postcode</Label>
                      <Input
                        id="co_post"
                        value={company.postcode ?? ""}
                        onChange={(e) => setCompany({ ...company, postcode: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="co_country">Country</Label>
                      <Input
                        id="co_country"
                        value={company.country ?? ""}
                        onChange={(e) => setCompany({ ...company, country: e.target.value })}
                        placeholder="United Kingdom"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="co_reg">Company number</Label>
                      <Input
                        id="co_reg"
                        value={company.company_number ?? ""}
                        onChange={(e) => setCompany({ ...company, company_number: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="co_vat">VAT number</Label>
                      <Input
                        id="co_vat"
                        value={company.vat_number ?? ""}
                        onChange={(e) => setCompany({ ...company, vat_number: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <Button size="sm" onClick={saveCompany} disabled={savingCompany}>
                      {savingCompany ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
                      Save company details
                    </Button>
                  </div>
                </>
              )}
            </Section>

            {/* Login email */}
            <Section
              icon={Mail}
              title="Login email"
              description="Change the address you sign in with. We email a confirmation link before it switches."
            >
              <p className="mb-3 text-sm">
                Current: <span className="font-medium">{email || "—"}</span>
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="new@example.com"
                  aria-label="New email address"
                />
                <Button size="sm" onClick={submitEmailChange} disabled={emailBusy || !newEmail.trim()}>
                  {emailBusy ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
                  Send confirmation
                </Button>
              </div>
            </Section>

            {/* Password */}
            <Section
              icon={KeyRound}
              title="Password"
              description="Enter your current password, then choose a new one of at least 8 characters."
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pw_current">Current password</Label>
                  <Input
                    id="pw_current"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pw_new">New password</Label>
                  <Input
                    id="pw_new"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pw_confirm">Confirm new password</Label>
                  <Input
                    id="pw_confirm"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
              <Separator className="my-4" />
              <Button
                size="sm"
                onClick={submitPasswordChange}
                disabled={passwordBusy || !currentPassword || !newPassword}
              >
                {passwordBusy ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
                Change password
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                Signed in with Google only? Use “Forgot password” on the sign-in page to set a password first.
              </p>
            </Section>
          </div>
        )}
      </SettingsShell>
      </PageBody>
    </AppShell>
  );
}
