import { createFileRoute } from "@tanstack/react-router";

import { GradeSummaryScreen } from "../-screens/grades/grade-summary-screen";

/** GRD-07 */
export const Route = createFileRoute("/prototype/sige/_shell/notas/resumen")({
  component: GradeSummaryScreen,
});
