import { createFileRoute } from "@tanstack/react-router";

import { AlertDetailScreen } from "../-screens/alerts/alert-detail-screen";

/** ALR-02 */
export const Route = createFileRoute("/prototype/sige/_shell/alertas/detalle")({
  component: AlertDetailScreen,
});
