import { createFileRoute } from "@tanstack/react-router";

import { UserImportPage } from "@/features/users";

export const Route = createFileRoute("/_auth/_org/usuarios/importar")({
  component: UserImportPage,
});
