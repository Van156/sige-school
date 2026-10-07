import { createFileRoute } from "@tanstack/react-router";

import { CreateInstitutionPage } from "@/features/institutions";

export const Route = createFileRoute("/_auth/admin/instituciones/nueva")({
  component: CreateInstitutionPage,
});
