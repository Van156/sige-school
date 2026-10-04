import { createFileRoute } from "@tanstack/react-router";

import { CriteriaScreen } from "../-screens/institution/criteria-screen";

/** INS-17 */
export const Route = createFileRoute("/prototype/sige/_shell/criterios/")({
  component: CriteriaScreen,
});
