import { createFileRoute } from "@tanstack/react-router";

import { ClassroomFormScreen } from "../-screens/school/classroom-form-screen";

/** SCH-08 */
export const Route = createFileRoute("/prototype/sige/_shell/salones/formulario")({
  component: ClassroomFormScreen,
});
