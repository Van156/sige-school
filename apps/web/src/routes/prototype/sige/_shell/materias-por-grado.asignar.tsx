import { createFileRoute } from "@tanstack/react-router";

import { SubjectGradesFormScreen } from "../-screens/school/subject-grades-form-screen";

/** SCH-06 */
export const Route = createFileRoute("/prototype/sige/_shell/materias-por-grado/asignar")({
  component: SubjectGradesFormScreen,
});
