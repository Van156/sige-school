import { createFileRoute } from "@tanstack/react-router";

import { CourseFormScreen } from "../-screens/institution/course-form-screen";

/** INS-12 */
export const Route = createFileRoute("/prototype/sige/_shell/cursos/formulario")({
  component: CourseFormScreen,
});
