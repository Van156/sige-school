import { createFileRoute } from "@tanstack/react-router";

import { AnnualGradesScreen } from "../-screens/grades/annual-grades-screen";

/** GRD-06 */
export const Route = createFileRoute("/prototype/sige/_shell/notas/anuales")({
  component: AnnualGradesScreen,
});
