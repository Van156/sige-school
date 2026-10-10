import { createFileRoute } from "@tanstack/react-router";

import { importSearchSchema } from "@/features/imports";
import { UserImportPage } from "@/features/users";

export const Route = createFileRoute("/_auth/_org/usuarios/importar")({
  validateSearch: importSearchSchema,
  component: RouteComponent,
});

function RouteComponent() {
  const { job } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <UserImportPage
      jobId={job ?? null}
      onJobChange={(next) => void navigate({ search: { job: next ?? undefined }, replace: true })}
    />
  );
}
