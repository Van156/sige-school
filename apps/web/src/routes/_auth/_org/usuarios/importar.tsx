import { createFileRoute } from "@tanstack/react-router";

import { UserImportPage, userImportSearchSchema } from "@/features/users";

export const Route = createFileRoute("/_auth/_org/usuarios/importar")({
  validateSearch: userImportSearchSchema,
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
