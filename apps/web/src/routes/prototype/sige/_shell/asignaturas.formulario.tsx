import { createFileRoute } from "@tanstack/react-router";

import { SubjectFormScreen } from "../-screens/institution/subject-form-screen";

/** INS-14 */
export const Route = createFileRoute("/prototype/sige/_shell/asignaturas/formulario")({
  component: SubjectFormScreen,
});
