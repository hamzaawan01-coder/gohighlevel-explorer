import { supabase } from "@/integrations/supabase/client";

export type AdPlatformConnection = {
  id: string;
  sub_account_id: string;
  platform: "google" | "meta";
  external_customer_id: string | null;
  account_name: string | null;
  accessible_customers: { id: string; name?: string }[];
  connected_by: string;
  last_synced_at: string | null;
  last_sync_error: string | null;
  created_at: string;
  updated_at: string;
};

export async function fetchAdConnections(subAccountId: string): Promise<AdPlatformConnection[]> {
  const { data, error } = await supabase
    .from("ad_platform_connections" as never)
    .select("id,sub_account_id,platform,external_customer_id,account_name,accessible_customers,connected_by,last_synced_at,last_sync_error,created_at,updated_at")
    .eq("sub_account_id", subAccountId);
  if (error) throw error;
  return (data ?? []) as unknown as AdPlatformConnection[];
}

export async function deleteAdConnection(id: string) {
  const { error } = await supabase.from("ad_platform_connections" as never).delete().eq("id", id);
  if (error) throw error;
}

export async function updateAdConnectionCustomer(id: string, external_customer_id: string, account_name: string | null) {
  const { error } = await supabase
    .from("ad_platform_connections" as never)
    .update({ external_customer_id, account_name } as never)
    .eq("id", id);
  if (error) throw error;
}
