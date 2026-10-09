import { createFileRoute } from "@tanstack/react-router";

import { LevelFormPage } from "@/features/institution";

export const Route = createFileRoute("/_auth/_org/niveles/$id/editar")({
  component: EditLevelRoute,
});

function EditLevelRoute() {
  const { id } = Route.useParams();
  return <LevelFormPage levelId={id} />;
}
