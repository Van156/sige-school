import { createFileRoute } from "@tanstack/react-router";

import { UsersImportScreen } from "../-screens/users/users-import-screen";

/** USR-04 */
export const Route = createFileRoute("/prototype/sige/_shell/usuarios/importar")({
  component: UsersImportScreen,
});
