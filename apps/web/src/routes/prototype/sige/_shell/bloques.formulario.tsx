import { createFileRoute } from "@tanstack/react-router";

import { BlockFormScreen } from "../-screens/school/block-form-screen";

/** SCH-10 */
export const Route = createFileRoute("/prototype/sige/_shell/bloques/formulario")({
  component: BlockFormScreen,
});
