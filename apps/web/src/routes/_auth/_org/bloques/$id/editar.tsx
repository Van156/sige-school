import { createFileRoute } from "@tanstack/react-router";

import { TimeBlockFormPage } from "@/features/scheduling";

export const Route = createFileRoute("/_auth/_org/bloques/$id/editar")({
  component: EditTimeBlockRoute,
});

function EditTimeBlockRoute() {
  const { id } = Route.useParams();
  return <TimeBlockFormPage blockId={id} />;
}
