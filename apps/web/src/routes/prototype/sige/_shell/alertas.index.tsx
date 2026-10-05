import { createFileRoute } from "@tanstack/react-router";

import { AlertsScreen } from "../-screens/alerts/alerts-screen";

/** ALR-01 */
export const Route = createFileRoute("/prototype/sige/_shell/alertas/")({
  component: AlertsScreen,
});
