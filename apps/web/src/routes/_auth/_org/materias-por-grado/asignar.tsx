import { createFileRoute } from "@tanstack/react-router";

import { OfferingBulkFormPage } from "@/features/scheduling";

export const Route = createFileRoute("/_auth/_org/materias-por-grado/asignar")({
  component: () => <OfferingBulkFormPage />,
});
