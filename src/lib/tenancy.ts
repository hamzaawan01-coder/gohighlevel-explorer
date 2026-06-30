import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase } from "@/integrations/supabase/client";

export type SubAccount = {
  id: string;
  agency_id: string;
  name: string;
  industry: string | null;
  timezone: string;
  archived_at: string | null;
};

export type Agency = {
  id: string;
  name: string;
  owner_user_id: string;
};

type TenancyState = {
  currentSubAccountId: string | null;
  setCurrent: (id: string | null) => void;
};

export const useTenancy = create<TenancyState>()(
  persist(
    (set) => ({
      currentSubAccountId: null,
      setCurrent: (id) => set({ currentSubAccountId: id }),
    }),
    { name: "tenancy:current" },
  ),
);

export async function fetchMySubAccounts(): Promise<SubAccount[]> {
  const { data, error } = await supabase
    .from("sub_accounts")
    .select("id, agency_id, name, industry, timezone, archived_at")
    .is("archived_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SubAccount[];
}

export async function fetchMyAgencies(): Promise<Agency[]> {
  const { data, error } = await supabase
    .from("agencies")
    .select("id, name, owner_user_id")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Agency[];
}

export async function createSubAccount(input: {
  agency_id: string;
  name: string;
  industry?: string | null;
}): Promise<SubAccount> {
  const { data, error } = await supabase
    .from("sub_accounts")
    .insert({
      agency_id: input.agency_id,
      name: input.name,
      industry: input.industry ?? null,
    })
    .select("id, agency_id, name, industry, timezone, archived_at")
    .single();
  if (error) throw error;
  return data as SubAccount;
}
