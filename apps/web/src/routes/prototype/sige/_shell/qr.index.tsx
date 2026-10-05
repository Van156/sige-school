import { createFileRoute } from "@tanstack/react-router";

import { MyQrScreen } from "../-screens/qr/my-qr-screen";

/** QR-01 */
export const Route = createFileRoute("/prototype/sige/_shell/qr/")({
  component: MyQrScreen,
});
