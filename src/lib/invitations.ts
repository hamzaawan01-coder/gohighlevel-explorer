import { supabase } from "@/integrations/supabase/client";

export type Invitation = {
  id: string;
  email: string;
  agency_id: string;
  sub_account_id: string | null;
  role: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

const INVITATION_COLUMNS =
  "id,email,agency_id,sub_account_id,role,expires_at,accepted_at,created_at,invited_by";

export type InvitationPreview = {
  email: string;
  agency_id: string;
  agency_name: string;
  sub_account_id: string | null;
  sub_account_name: string | null;
  role: string;
  expires_at: string;
  accepted_at: string | null;
};

export type AgencyMember = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  scope: "agency" | "sub_account";
  sub_account_id: string | null;
  sub_account_name: string | null;
};

export async function fetchInvitations(agencyId: string): Promise<Invitation[]> {
  const { data, error } = await supabase
    .from("invitations")
    .select(INVITATION_COLUMNS)
    .eq("agency_id", agencyId)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Invitation[];
}

export async function createInvitation(input: {
  email: string;
  agency_id: string;
  role: "owner" | "admin" | "member" | "client";
  sub_account_id?: string | null;
}): Promise<{ invitation: Invitation; token: string }> {
  const { data: userData } = await supabase.auth.getUser();
  const invited_by = userData.user?.id;
  if (!invited_by) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("invitations")
    .insert({
      email: input.email.toLowerCase().trim(),
      agency_id: input.agency_id,
      role: input.role,
      sub_account_id: input.sub_account_id ?? null,
      invited_by,
    })
    .select(INVITATION_COLUMNS)
    .single();
  if (error) throw error;
  const invitation = data as unknown as Invitation;
  const token = await fetchInvitationToken(invitation.id);
  return { invitation, token };
}

export async function revokeInvitation(id: string): Promise<void> {
  const { error } = await supabase.from("invitations").delete().eq("id", id);
  if (error) throw error;
}

/** Fetch the raw invite token — server-side check ensures only the creator can read it. */
export async function fetchInvitationToken(id: string): Promise<string> {
  const { data, error } = await supabase.rpc("get_invitation_token" as never, { _id: id } as never);
  if (error) throw error;
  if (!data) throw new Error("Invitation token not available");
  return data as unknown as string;
}

export async function previewInvitation(token: string): Promise<InvitationPreview | null> {
  const { data, error } = await supabase.rpc("preview_invitation", { _token: token });
  if (error) throw error;
  const row = (data ?? [])[0];
  return row ? (row as InvitationPreview) : null;
}

export async function acceptInvitation(token: string) {
  const { data, error } = await supabase.rpc("accept_invitation", { _token: token });
  if (error) throw error;
  return (data ?? [])[0] as { agency_id: string; sub_account_id: string | null; role: string } | undefined;
}

export async function fetchAgencyMembers(agencyId: string): Promise<AgencyMember[]> {
  const { data, error } = await supabase.rpc("list_agency_members", { _agency: agencyId });
  if (error) throw error;
  return (data ?? []) as AgencyMember[];
}

export function buildInviteUrl(token: string): string {
  if (typeof window === "undefined") return `/invite/${token}`;
  return `${window.location.origin}/invite/${token}`;
}
