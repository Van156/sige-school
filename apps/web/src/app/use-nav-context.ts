import { useQuery } from "@tanstack/react-query";

import { authClient } from "@/app/auth-client";
import { orpc } from "@/app/orpc";
import { isSuperadminRole, useOrgRoles } from "@/features/access-control";

import { sigeMeQueryOptions } from "./sige-me";
import { resolveHasOrganization, resolveNavPermissions, type NavContext } from "./navigation";

/**
 * The signed-in user's SIGE identity from `me.get`. Keyed by user id so a second sign-in in the
 * same tab never reuses the previous user's role. An account without a person (platform admins)
 * settles to `null`, which the sidebar treats as "no SIGE kind".
 */
export function useSigeMe() {
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;
  return useQuery({
    ...sigeMeQueryOptions(userId, () => orpc.me.get.call()),
    enabled: Boolean(userId),
  });
}

/** The context the sidebar and section tabs evaluate their `visible` predicates with. */
export function useNavContext(): NavContext {
  const { data: session } = authClient.useSession();
  const { data: organizations, isPending, error } = authClient.useListOrganizations();
  const { data: me } = useSigeMe();
  const activeOrganizationId = session?.session.activeOrganizationId ?? undefined;
  const { data: customRoles } = useOrgRoles(
    me?.kind === "custom" ? activeOrganizationId : undefined,
  );

  return {
    isSuperadmin: isSuperadminRole(session?.user.role),
    hasOrganization: resolveHasOrganization({
      activeOrganizationId,
      organizationCount: organizations?.length,
      isLoading: isPending,
      hasError: Boolean(error),
    }),
    kind: me?.kind ?? null,
    permissions: resolveNavPermissions(me, customRoles),
  };
}
