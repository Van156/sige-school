import { createFileRoute } from "@tanstack/react-router";

import { StudentFormScreen } from "../-screens/students/student-form-screen";

/** STU-03 */
export const Route = createFileRoute("/prototype/sige/_shell/estudiantes/formulario")({
  component: StudentFormScreen,
});
