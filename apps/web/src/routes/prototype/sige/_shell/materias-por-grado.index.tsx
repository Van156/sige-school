import { createFileRoute } from "@tanstack/react-router";

import { SubjectGradesScreen } from "../-screens/school/subject-grades-screen";

/** SCH-05 */
export const Route = createFileRoute("/prototype/sige/_shell/materias-por-grado/")({
  component: SubjectGradesScreen,
});
