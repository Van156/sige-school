import { createFileRoute } from "@tanstack/react-router";

import { FinalGradesScreen } from "../-screens/grades/final-grades-screen";

/** GRD-05 */
export const Route = createFileRoute("/prototype/sige/_shell/notas/finales")({
  component: FinalGradesScreen,
});
