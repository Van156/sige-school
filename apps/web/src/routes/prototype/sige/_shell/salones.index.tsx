import { createFileRoute } from "@tanstack/react-router";

import { ClassroomsScreen } from "../-screens/school/classrooms-screen";

/** SCH-07 */
export const Route = createFileRoute("/prototype/sige/_shell/salones/")({
  component: ClassroomsScreen,
});
