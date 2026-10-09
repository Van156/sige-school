import { createFileRoute } from "@tanstack/react-router";

import { UserCreatePage, userCreateSearchSchema } from "@/features/users";

export const Route = createFileRoute("/_auth/_org/usuarios/nuevo")({
  validateSearch: userCreateSearchSchema,
  component: RouteComponent,
});

function RouteComponent() {
  return <UserCreatePage role={Route.useSearch().role} />;
}
