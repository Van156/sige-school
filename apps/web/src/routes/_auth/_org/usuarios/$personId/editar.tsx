import { createFileRoute } from "@tanstack/react-router";

import { UserEditPage } from "@/features/users";

export const Route = createFileRoute("/_auth/_org/usuarios/$personId/editar")({
  component: EditUserRoute,
});

function EditUserRoute() {
  const { personId } = Route.useParams();
  return <UserEditPage personId={personId} />;
}
