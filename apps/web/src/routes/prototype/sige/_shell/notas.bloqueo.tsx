import { createFileRoute } from "@tanstack/react-router";

import { PeriodLockScreen } from "../-screens/grades/period-lock-screen";

/** GRD-04 */
export const Route = createFileRoute("/prototype/sige/_shell/notas/bloqueo")({
  component: PeriodLockScreen,
});
