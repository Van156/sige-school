import { createFileRoute } from "@tanstack/react-router";

import { EnrollmentFormScreen } from "../-screens/school/enrollment-form-screen";

/** SCH-02 */
export const Route = createFileRoute("/prototype/sige/_shell/matriculas/formulario")({
  component: EnrollmentFormScreen,
});
