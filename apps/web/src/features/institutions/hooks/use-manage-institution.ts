import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { authClient } from "@/app/auth-client";
import { client } from "@/app/orpc";
import { betterAuthErrorMessage } from "@/features/auth";

import { MANAGE_FAILED_MESSAGE, startManagement } from "../lib/manage-flow";

/**
 * INS-03 "Gestionar" / INS-01 "Gestionar sedes": `institutionAdmin.manage`, then the existing
 * better-auth impersonation of the rector, then `destination` inside the tenant area. Every cached
 * query depended on "who am I", so all are invalidated before navigating.
 */
export function useManageInstitution(destination: "/dashboard" | "/sedes") {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: (institutionId: string) =>
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
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("Institución seleccionada");
      await navigate({ to: destination });
    },
    onError: (error) => {
      toast.error(betterAuthErrorMessage(error, MANAGE_FAILED_MESSAGE));
    },
  });

  return {
    /** Stable across renders (TanStack's `mutate`). */
    manage: mutation.mutate,
    isPending: mutation.isPending,
    /** The institution being opened, for a per-row pending state. */
    pendingId: mutation.isPending ? mutation.variables : undefined,
  };
}
