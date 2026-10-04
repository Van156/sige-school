import { createFileRoute } from "@tanstack/react-router";

import { GradeInputScreen } from "../-screens/grades/grade-input-screen";

/** GRD-02 */
export const Route = createFileRoute("/prototype/sige/_shell/notas/planilla")({
  component: GradeInputScreen,
});
