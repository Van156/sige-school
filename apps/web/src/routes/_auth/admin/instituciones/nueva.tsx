import { createFileRoute } from "@tanstack/react-router";

import { InstitutionFormPage } from "@/features/institutions";

export const Route = createFileRoute("/_auth/admin/instituciones/nueva")({
  component: () => <InstitutionFormPage />,
});
