import { createFileRoute } from "@tanstack/react-router";

import { ReportCardsScreen } from "../-screens/report-cards/report-cards-screen";

/** RPT-01 */
export const Route = createFileRoute("/prototype/sige/_shell/boletines/")({
  component: ReportCardsScreen,
});
