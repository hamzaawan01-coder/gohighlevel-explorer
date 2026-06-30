import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { acceptInvitation, previewInvitation } from "@/lib/invitations";
import { useTenancy } from "@/lib/tenancy";
import { toast } from "sonner";
import { Building2, Mail, Loader2 } from "lucide-react";

export const Route = createFileRoute("/invite/$token")({
  ssr: false,
  head: () => ({ meta: [{ title: "Accept invitation" }] }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { setCurrent } = useTenancy();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
      setAuthChecked(true);
    });
  }, []);

  const previewQ = useQuery({
    queryKey: ["invite-preview", token],
    queryFn: () => previewInvitation(token),
    enabled: authChecked && !!userEmail,
  });

  const acceptMut = useMutation({
    mutationFn: () => acceptInvitation(token),
    onSuccess: (res) => {
      qc.invalidateQueries();
      if (res?.sub_account_id) setCurrent(res.sub_account_id);
      toast.success("You're in!");
      navigate({ to: "/dashboard" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not accept invite"),
  });

  if (!authChecked) {
    return <Centered><Loader2 className="size-5 animate-spin text-muted-foreground" /></Centered>;
  }

  if (!userEmail) {
    return (
      <Centered>
        <Card>
          <Mail className="size-8 text-muted-foreground mx-auto mb-3" />
          <h1 className="text-lg font-semibold">Sign in to accept your invite</h1>
          <p className="text-sm text-muted-foreground mt-2">
            You need an account to join this team.
          </p>
          <Link
            to="/auth"
            search={{ redirect: `/invite/${token}` } as any}
            className="block mt-4"
          >
            <Button className="w-full">Sign in or create account</Button>
          </Link>
        </Card>
      </Centered>
    );
  }

  if (previewQ.isLoading) {
    return <Centered><Loader2 className="size-5 animate-spin text-muted-foreground" /></Centered>;
  }

  const preview = previewQ.data;
  if (!preview) {
    return (
      <Centered>
        <Card>
          <h1 className="text-lg font-semibold">Invitation not found</h1>
          <p className="text-sm text-muted-foreground mt-2">This link may have been revoked.</p>
        </Card>
      </Centered>
    );
  }

  if (preview.accepted_at) {
    return (
      <Centered>
        <Card>
          <h1 className="text-lg font-semibold">Already accepted</h1>
          <Link to="/dashboard" className="block mt-4"><Button className="w-full">Go to dashboard</Button></Link>
        </Card>
      </Centered>
    );
  }

  const expired = new Date(preview.expires_at) < new Date();
  if (expired) {
    return (
      <Centered>
        <Card>
          <h1 className="text-lg font-semibold">Invitation expired</h1>
          <p className="text-sm text-muted-foreground mt-2">Ask the inviter to send a new link.</p>
        </Card>
      </Centered>
    );
  }

  const emailMismatch = preview.email.toLowerCase() !== userEmail.toLowerCase();

  return (
    <Centered>
      <Card>
        <Building2 className="size-8 text-accent mx-auto mb-3" />
        <h1 className="text-xl font-semibold text-center">Join {preview.agency_name}</h1>
        <p className="text-sm text-muted-foreground text-center mt-2">
          You've been invited as <span className="text-foreground font-medium">{preview.role}</span>
          {preview.sub_account_name ? <> in <span className="text-foreground font-medium">{preview.sub_account_name}</span></> : null}.
        </p>

        {emailMismatch ? (
          <div className="mt-5 p-3 rounded-md bg-destructive/10 text-destructive text-xs">
            This invite is for <b>{preview.email}</b> but you're signed in as <b>{userEmail}</b>.
            Sign in with the correct email to accept.
          </div>
        ) : (
          <Button
            className="w-full mt-5"
            onClick={() => acceptMut.mutate()}
            disabled={acceptMut.isPending}
          >
            {acceptMut.isPending ? "Joining…" : "Accept invitation"}
          </Button>
        )}
      </Card>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      {children}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
      {children}
    </div>
  );
}
