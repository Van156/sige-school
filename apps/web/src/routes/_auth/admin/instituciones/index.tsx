import { createFileRoute } from "@tanstack/react-router";

import { InstitutionsPage } from "@/features/institutions";

export const Route = createFileRoute("/_auth/admin/instituciones/")({
  component: InstitutionsPage,
});
