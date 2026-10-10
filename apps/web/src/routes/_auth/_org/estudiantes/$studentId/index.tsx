import { createFileRoute, stripSearchParams } from "@tanstack/react-router";

import {
  StudentProfilePage,
  studentProfileSearchDefaults,
  studentProfileSearchSchema,
} from "@/features/students";

export const Route = createFileRoute("/_auth/_org/estudiantes/$studentId/")({
  validateSearch: studentProfileSearchSchema,
  search: { middlewares: [stripSearchParams(studentProfileSearchDefaults)] },
  component: StudentProfileRoute,
});

function StudentProfileRoute() {
  const { studentId } = Route.useParams();
  return <StudentProfilePage studentId={studentId} search={Route.useSearch()} />;
}
