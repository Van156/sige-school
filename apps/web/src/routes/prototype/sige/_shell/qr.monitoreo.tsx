import { createFileRoute } from "@tanstack/react-router";

import { QrMonitoringScreen } from "../-screens/qr/qr-monitoring-screen";

/** QR-03 */
export const Route = createFileRoute("/prototype/sige/_shell/qr/monitoreo")({
  component: QrMonitoringScreen,
});
