import { createFileRoute } from "@tanstack/react-router";

import { ChildReportCardsScreen } from "../-screens/parent/child-report-cards-screen";

/** PAR-05 */
export const Route = createFileRoute("/prototype/sige/_shell/portal-padres/boletines")({
  component: ChildReportCardsScreen,
});
