import { createFileRoute } from "@tanstack/react-router";

import { PeriodFormScreen } from "../-screens/institution/period-form-screen";

/** INS-16 */
export const Route = createFileRoute("/prototype/sige/_shell/periodos/formulario")({
  component: PeriodFormScreen,
});
