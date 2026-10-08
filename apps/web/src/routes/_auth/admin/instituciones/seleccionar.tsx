import { createFileRoute } from "@tanstack/react-router";

import { InstitutionSelectorPage } from "@/features/institutions";

export const Route = createFileRoute("/_auth/admin/instituciones/seleccionar")({
  component: InstitutionSelectorPage,
});
