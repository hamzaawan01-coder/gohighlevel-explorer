import { supabase } from "@/integrations/supabase/client";

/** Personal details for the signed-in user. */
export type MyProfile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  job_title: string | null;
  timezone: string | null;
  signature: string | null;
};

/** Company / workspace details shown on invoices, emails and booking pages. */
export type CompanyProfile = {
  id: string;
  name: string;
  industry: string | null;
  timezone: string;
  logo_url: string | null;
  website: string | null;
  support_email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
  company_number: string | null;
  vat_number: string | null;
};

const AVATARS = "avatars";
const BRANDING = "branding";

const PROFILE_COLUMNS = "id, full_name, avatar_url, phone, job_title, timezone, signature";
const COMPANY_COLUMNS =
  "id, name, industry, timezone, logo_url, website, support_email, phone, address_line1, address_line2, city, postcode, country, company_number, vat_number";

/** Read (and lazily create) the signed-in user's profile row. */
export async function fetchMyProfile(userId: string): Promise<MyProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (data) return data as unknown as MyProfile;

  const { data: created, error: insErr } = await supabase
    .from("profiles")
    .insert({ id: userId } as never)
    .select(PROFILE_COLUMNS)
    .single();
  if (insErr) throw insErr;
  return created as unknown as MyProfile;
}

export async function updateMyProfile(
  userId: string,
  patch: Partial<Omit<MyProfile, "id">>,
): Promise<MyProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .update(patch as never)
    .eq("id", userId)
    .select(PROFILE_COLUMNS)
    .single();
  if (error) throw error;
  return data as unknown as MyProfile;
}

export async function fetchCompanyProfile(subAccountId: string): Promise<CompanyProfile | null> {
  const { data, error } = await supabase
    .from("sub_accounts")
    .select(COMPANY_COLUMNS)
    .eq("id", subAccountId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as CompanyProfile | null) ?? null;
}

export async function updateCompanyProfile(
  subAccountId: string,
  patch: Partial<Omit<CompanyProfile, "id">>,
): Promise<CompanyProfile> {
  const { data, error } = await supabase
    .from("sub_accounts")
    .update(patch as never)
    .eq("id", subAccountId)
    .select(COMPANY_COLUMNS)
    .single();
  if (error) throw error;
  return data as unknown as CompanyProfile;
}

/** Both buckets are private, so images are shown through short-lived signed URLs. */
export async function signedImageUrl(
  bucket: string,
  path: string,
  seconds = 60 * 60,
): Promise<string | null> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, seconds);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export function isStoragePath(value: string | null | undefined): boolean {
  return !!value && !/^https?:\/\//i.test(value);
}

/** Resolve a stored value that may be either a storage path or an external URL. */
export async function resolveImageSrc(
  bucket: string,
  value: string | null | undefined,
): Promise<string | null> {
  if (!value) return null;
  if (!isStoragePath(value)) return value;
  return signedImageUrl(bucket, value);
}

export const AVATAR_BUCKET = AVATARS;
export const BRANDING_BUCKET = BRANDING;

function safeName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_");
}

/** Upload a new avatar and store its path on the profile. Returns the path. */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const path = `${userId}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const { error } = await supabase.storage
    .from(AVATARS)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw error;
  await updateMyProfile(userId, { avatar_url: path });
  return path;
}

/** Upload a company logo and store its path on the workspace. Returns the path. */
export async function uploadCompanyLogo(subAccountId: string, file: File): Promise<string> {
  const path = `${subAccountId}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const { error } = await supabase.storage
    .from(BRANDING)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw error;
  await updateCompanyProfile(subAccountId, { logo_url: path });
  return path;
}

export async function removeAvatar(userId: string, current: string | null) {
  if (current && isStoragePath(current)) {
    await supabase.storage.from(AVATARS).remove([current]);
  }
  await updateMyProfile(userId, { avatar_url: null });
}

export async function removeCompanyLogo(subAccountId: string, current: string | null) {
  if (current && isStoragePath(current)) {
    await supabase.storage.from(BRANDING).remove([current]);
  }
  await updateCompanyProfile(subAccountId, { logo_url: null });
}

/** Request an email change; Supabase sends a confirmation link to the new address. */
export async function requestEmailChange(newEmail: string) {
  const { error } = await supabase.auth.updateUser({ email: newEmail });
  if (error) throw error;
}

export async function changePassword(currentEmail: string, currentPassword: string, newPassword: string) {
  // Re-authenticate first so a stolen session cannot silently change the password.
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: currentEmail,
    password: currentPassword,
  });
  if (signInErr) throw new Error("Current password is incorrect.");
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

/** Basic validation shared by the profile form. */
export function validateImage(file: File): string | null {
  if (!file.type.startsWith("image/")) return "Please choose an image file (PNG, JPG, SVG or WebP).";
  if (file.size > 5 * 1024 * 1024) return "Images must be 5MB or smaller.";
  return null;
}
