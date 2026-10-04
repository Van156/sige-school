import { createFileRoute } from "@tanstack/react-router";

import { StudentGradesScreen } from "../-screens/grades/student-grades-screen";

/** GRD-08 */
export const Route = createFileRoute("/prototype/sige/_shell/notas/estudiante")({
  component: StudentGradesScreen,
});
