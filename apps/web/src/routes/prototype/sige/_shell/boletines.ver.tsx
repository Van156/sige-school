import { createFileRoute } from "@tanstack/react-router";

import { ReportCardViewScreen } from "../-screens/report-cards/report-card-view-screen";

/** RPT-04 */
export const Route = createFileRoute("/prototype/sige/_shell/boletines/ver")({
  component: ReportCardViewScreen,
});
