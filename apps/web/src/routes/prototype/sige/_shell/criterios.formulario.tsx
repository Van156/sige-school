import { createFileRoute } from "@tanstack/react-router";

import { CriterionFormScreen } from "../-screens/institution/criterion-form-screen";

/** INS-18 */
export const Route = createFileRoute("/prototype/sige/_shell/criterios/formulario")({
  component: CriterionFormScreen,
});
