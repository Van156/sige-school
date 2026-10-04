import { createFileRoute } from "@tanstack/react-router";

import { GradeSelectScreen } from "../-screens/grades/grade-select-screen";

/** GRD-01 */
export const Route = createFileRoute("/prototype/sige/_shell/notas/")({
  component: GradeSelectScreen,
});
