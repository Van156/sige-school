import { createFileRoute } from "@tanstack/react-router";

import { UsersListScreen } from "../-screens/users/users-list-screen";

/** USR-01 */
export const Route = createFileRoute("/prototype/sige/_shell/usuarios/")({
  component: UsersListScreen,
});
