import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { authClient } from "@/app/auth-client";
import { orpc } from "@/app/orpc";
import { betterAuthErrorMessage } from "@/features/auth";
import { INSTITUTION_SELECTOR_PATH } from "@/features/institution";

import {
  impersonationBannerMessage,
  institutionQueryKeyFor,
  shouldShowImpersonationBanner,
} from "../lib/impersonation-banner";
import ImpersonationBannerView from "./impersonation-banner-view";

/**
 * App-wide banner (R6.4) while the session has `impersonatedBy`. "Dejar de gestionar" restores
 * the superadmin's session through better-auth's client, invalidates every cached query and
 * returns to the institution selector (sige/02 INS-03). The institution name comes from
 * `institution.get`, which needs an active organization, so it waits for one (the tenant route
 * guard activates it right after an impersonation starts). See
 * docs/architecture/web-app.md#impersonation.
 */
export default function ImpersonationBanner() {
  const { data: session } = authClient.useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const visible = shouldShowImpersonationBanner(session?.session.impersonatedBy);

  const activeOrganizationId = session?.session.activeOrganizationId;
  const institutionOptions = orpc.institution.get.queryOptions();
  const institutionQuery = useQuery({
    ...institutionOptions,
    queryKey: institutionQueryKeyFor(institutionOptions.queryKey, activeOrganizationId),
    enabled: visible && Boolean(activeOrganizationId),
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.admin.stopImpersonating();
      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      navigate({ to: INSTITUTION_SELECTOR_PATH });
    },
    onError: (error) => {
      toast.error(betterAuthErrorMessage(error, "No se pudo dejar de gestionar."));
    },
  });

  if (!visible) {
    return null;
  }

  return (
    <ImpersonationBannerView
      message={impersonationBannerMessage({
        institutionName: institutionQuery.data?.name,
        userName: session?.user.name,
        userEmail: session?.user.email,
      })}
      isStopping={mutation.isPending}
      onStop={() => mutation.mutate()}
    />
  );
}
