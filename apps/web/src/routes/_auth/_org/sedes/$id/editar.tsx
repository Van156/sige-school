import { createFileRoute } from "@tanstack/react-router";

import { CampusFormPage } from "@/features/institution";

export const Route = createFileRoute("/_auth/_org/sedes/$id/editar")({
  component: EditCampusRoute,
});

function EditCampusRoute() {
  const { id } = Route.useParams();
  return <CampusFormPage campusId={id} />;
}
