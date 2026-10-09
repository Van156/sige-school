import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { toast } from "sonner";

import { authClient } from "@/app/auth-client";
import { client } from "@/app/orpc";
import { betterAuthErrorMessage } from "@/features/auth";

import { MANAGE_FAILED_MESSAGE, startManagement } from "../lib/manage-flow";

/** Where the root lands once the impersonation of the rector started. */
export type ManageDestination =
  | { to: "/dashboard" | "/sedes" }
  | { to: "/usuarios/$personId/editar"; params: { personId: string } };

/**
 * "Gestionar" (INS-03, INS-01, INS-04 "Editar"): `institutionAdmin.manage`, then the existing
 * better-auth impersonation of the rector, then `destination` inside the tenant area. Every cached
 * query depended on "who am I", so all are invalidated before navigating.
 */
export function useManagement() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: ({ institutionId }: { institutionId: string; destination: ManageDestination }) =>
      startManagement(
        {
          resolveRector: (id) => client.institutionAdmin.manage({ id }),
          impersonate: async (userId) => {
            const { error } = await authClient.admin.impersonateUser({ userId });
            if (error) {
              throw error;
            }
          },
        },
        institutionId,
      ),
    onSuccess: async (_result, { destination }) => {
      await queryClient.invalidateQueries();
      toast.success("Institución seleccionada");
      await navigate(destination);
    },
    onError: (error) => {
      toast.error(betterAuthErrorMessage(error, MANAGE_FAILED_MESSAGE));
    },
  });

  return {
    /** Stable across renders (TanStack's `mutate`). */
    start: mutation.mutate,
    isPending: mutation.isPending,
    /** The institution being opened, for a per-row pending state. */
    pendingId: mutation.isPending ? mutation.variables.institutionId : undefined,
  };
}

/** INS-03 "Gestionar" / INS-01 "Gestionar sedes": manage an institution and land on `destination`. */
export function useManageInstitution(destination: "/dashboard" | "/sedes") {
  const { start, isPending, pendingId } = useManagement();
  const manage = useCallback(
    (institutionId: string) => start({ institutionId, destination: { to: destination } }),
    [start, destination],
  );
  return { manage, isPending, pendingId };
}
