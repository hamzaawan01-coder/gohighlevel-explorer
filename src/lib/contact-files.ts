import { supabase } from "@/integrations/supabase/client";

export type ContactFile = {
  id: string;
  contact_id: string;
  sub_account_id: string;
  uploaded_by: string;
  name: string;
  storage_path: string;
  size: number;
  content_type: string | null;
  created_at: string;
};

const BUCKET = "contact-files";

export async function fetchContactFiles(contactId: string): Promise<ContactFile[]> {
  const { data, error } = await supabase
    .from("contact_files")
    .select("*")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ContactFile[];
}

export async function uploadContactFile(params: {
  file: File;
  contactId: string;
  subAccountId: string;
  userId: string;
}): Promise<ContactFile> {
  const { file, contactId, subAccountId, userId } = params;
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${subAccountId}/${contactId}/${crypto.randomUUID()}-${safeName}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from("contact_files")
    .insert({
      contact_id: contactId,
      sub_account_id: subAccountId,
      uploaded_by: userId,
      name: file.name,
      storage_path: path,
      size: file.size,
      content_type: file.type || null,
    })
    .select("*")
    .single();
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw error;
  }
  return data as ContactFile;
}

export async function deleteContactFile(file: ContactFile): Promise<void> {
  const { error: delErr } = await supabase.storage.from(BUCKET).remove([file.storage_path]);
  if (delErr) throw delErr;
  const { error } = await supabase.from("contact_files").delete().eq("id", file.id);
  if (error) throw error;
}

export async function getContactFileUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function isImage(ct: string | null | undefined): boolean {
  return !!ct && ct.startsWith("image/");
}
