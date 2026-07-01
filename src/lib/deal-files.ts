import { supabase } from "@/integrations/supabase/client";

export type DealFile = {
  id: string;
  deal_id: string;
  sub_account_id: string;
  uploaded_by: string;
  name: string;
  storage_path: string;
  size: number;
  content_type: string | null;
  created_at: string;
};

const BUCKET = "deal-files";

export async function fetchDealFiles(dealId: string): Promise<DealFile[]> {
  const { data, error } = await supabase
    .from("deal_files")
    .select("*")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DealFile[];
}

export async function uploadDealFile(params: {
  file: File;
  dealId: string;
  subAccountId: string;
  userId: string;
}): Promise<DealFile> {
  const { file, dealId, subAccountId, userId } = params;
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${subAccountId}/${dealId}/${crypto.randomUUID()}-${safeName}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from("deal_files")
    .insert({
      deal_id: dealId,
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
  return data as DealFile;
}

export async function deleteDealFile(file: DealFile): Promise<void> {
  const { error: delErr } = await supabase.storage.from(BUCKET).remove([file.storage_path]);
  if (delErr) throw delErr;
  const { error } = await supabase.from("deal_files").delete().eq("id", file.id);
  if (error) throw error;
}

export async function getDealFileUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}
