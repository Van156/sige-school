import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, useNavigate } from "@tanstack/react-router";
import { LogOut, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@base-template/ui/components/button";

import { authClient } from "@/app/auth-client";
import { orpc } from "@/app/orpc";
import { clearSigeMeCache } from "@/app/sige-me";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";

import { FORCED_CHANGE_SUCCESS_MESSAGE, submitForcedPasswordChange } from "../lib/forced-password";
import { handleSignOut } from "../lib/sign-out";
import AuthCard from "./auth-card";
import ForcedPasswordForm, { type ForcedPasswordValues } from "./forced-password-form";

/**
 * `/cambiar-contrasena` (AUTH-03, container): reads the caller's identity from the gate-exempt
 * `me.get`, changes the password with `authClient.changePassword` (other sessions revoked) and
 * lands on `/dashboard`. A user who does not need to change it is sent straight there.
 */
export default function ForcedPasswordPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const changePassword = useMutation({
    mutationFn: async ({ currentPassword, newPassword }: ForcedPasswordValues) => {
      await submitForcedPasswordChange({
        changePassword: () =>
          authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true }),
        refreshSession: () => authClient.getSession({ query: { disableCookieCache: true } }),
        clearGateCache: () => clearSigeMeCache(queryClient),
      });
    },
    onSuccess: async () => {
      // The change issues a fresh session without an active organization. Drop the cached gate
      // state (no refetch: `me.get` needs the organization) so the `_org` guard on `/dashboard`
      // re-activates the institution and re-reads `me`.
      queryClient.removeQueries({ queryKey: orpc.me.key() });
      clearSigeMeCache(queryClient);
      toast.success(FORCED_CHANGE_SUCCESS_MESSAGE);
      // The password change already succeeded: refreshing the session is best-effort, and a
      // failure (network blip) falls back to a hard navigation that reloads it.
      try {
        const { error } = await authClient.getSession({ query: { disableCookieCache: true } });
        if (error) {
          throw error;
        }
      } catch {
        window.location.assign("/dashboard");
        return;
      }
      void navigate({ to: "/dashboard" });
    },
  });

  // Stops observing `me` once the password changed, so dropping its cache does not refetch it
  // before the organization is re-activated.
  const meQuery = useQuery({ ...orpc.me.get.queryOptions(), enabled: !changePassword.isSuccess });

  if (meQuery.isPending) {
    return <Loader />;
  }
  if (meQuery.isError || !meQuery.data) {
    return (
      <LoadError message="No se pudo cargar su información." onRetry={() => meQuery.refetch()} />
    );
  }
  const { person, user } = meQuery.data;
  if (!person.mustChangePassword) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <AuthCard
      title={
        <span className="flex items-center gap-3">
          <TriangleAlert aria-hidden="true" className="size-6" />
          Cambiar Contraseña
        </span>
      }
      description="Es obligatorio cambiar su contraseña antes de continuar"
    >
      <ForcedPasswordForm
        fullName={`${person.firstName} ${person.lastName}`}
        username={user.username}
        onSubmit={(values) => changePassword.mutateAsync(values)}
      />
      <Button
        type="button"
        variant="ghost"
        className="self-start"
        onClick={() =>
          void handleSignOut({
            signOut: () => authClient.signOut(),
            clearUserCaches: () => clearSigeMeCache(queryClient),
            onSignedOut: () => void navigate({ to: "/sign-in", search: {} }),
            showError: (message) => toast.error(message),
          })
        }
      >
        <LogOut data-icon="inline-start" />
        Cerrar Sesión
      </Button>
    </AuthCard>
  );
}
