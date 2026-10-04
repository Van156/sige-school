import { createFileRoute } from "@tanstack/react-router";

import { ReportCardHistoryScreen } from "../-screens/report-cards/report-card-history-screen";

/** RPT-03 */
export const Route = createFileRoute("/prototype/sige/_shell/boletines/historial")({
  component: ReportCardHistoryScreen,
});
