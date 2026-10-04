import { createFileRoute } from "@tanstack/react-router";

import { StudentsScreen } from "../-screens/students/students-screen";

/** STU-01 */
export const Route = createFileRoute("/prototype/sige/_shell/estudiantes/")({
  component: StudentsScreen,
});
