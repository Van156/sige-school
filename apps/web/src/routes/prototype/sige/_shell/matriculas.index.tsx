import { createFileRoute } from "@tanstack/react-router";

import { EnrollmentsScreen } from "../-screens/school/enrollments-screen";

/** SCH-01 */
export const Route = createFileRoute("/prototype/sige/_shell/matriculas/")({
  component: EnrollmentsScreen,
});
