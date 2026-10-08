import { createFileRoute } from "@tanstack/react-router";

import { InstitutionProfilePage } from "@/features/institution";

export const Route = createFileRoute("/_auth/_org/configuracion-institucion")({
  component: InstitutionProfilePage,
});
