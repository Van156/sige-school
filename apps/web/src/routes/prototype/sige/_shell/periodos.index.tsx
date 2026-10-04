import { createFileRoute } from "@tanstack/react-router";

import { PeriodsScreen } from "../-screens/institution/periods-screen";

/** INS-15 */
export const Route = createFileRoute("/prototype/sige/_shell/periodos/")({
  component: PeriodsScreen,
});
