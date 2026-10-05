import { createFileRoute } from "@tanstack/react-router";

import { QrSimulatorScreen } from "../-screens/qr/qr-simulator-screen";

/** QR-02 */
export const Route = createFileRoute("/prototype/sige/_shell/qr/simulador")({
  component: QrSimulatorScreen,
});
