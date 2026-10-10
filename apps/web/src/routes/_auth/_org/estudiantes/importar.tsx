import { createFileRoute } from "@tanstack/react-router";

import { importSearchSchema } from "@/features/imports";
import { StudentImportPage } from "@/features/students";

export const Route = createFileRoute("/_auth/_org/estudiantes/importar")({
  validateSearch: importSearchSchema,
  component: StudentImportRoute,
});

function StudentImportRoute() {
  const { job } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <StudentImportPage
      jobId={job ?? null}
      onJobChange={(next) => void navigate({ search: { job: next ?? undefined }, replace: true })}
    />
  );
}
