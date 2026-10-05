import { createFileRoute } from "@tanstack/react-router";

import { AlertEngineScreen } from "../-screens/alerts/alert-engine-screen";

/** ALR-03 */
export const Route = createFileRoute("/prototype/sige/_shell/alertas/motor")({
  component: AlertEngineScreen,
});
