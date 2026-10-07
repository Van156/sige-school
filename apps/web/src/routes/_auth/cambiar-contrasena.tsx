import { createFileRoute } from "@tanstack/react-router";

import { AuthLayout, ForcedPasswordPage } from "@/features/auth";

/**
 * AUTH-03 (sige/01 §4.2): forced first-login password change. A direct child of `_auth` without
 * `appShell`, so it renders bare (no sidebar): the only exit is the password change or sign-out.
 */
export const Route = createFileRoute("/_auth/cambiar-contrasena")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <AuthLayout>
      <ForcedPasswordPage />
    </AuthLayout>
  );
}
