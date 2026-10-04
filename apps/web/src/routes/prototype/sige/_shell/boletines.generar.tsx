import { createFileRoute } from "@tanstack/react-router";

import { GenerateReportCardScreen } from "../-screens/report-cards/generate-report-card-screen";

/** RPT-02 */
export const Route = createFileRoute("/prototype/sige/_shell/boletines/generar")({
  component: GenerateReportCardScreen,
});
