import { createFileRoute, stripSearchParams } from "@tanstack/react-router";

import { UsersPage, userSearchDefaults, userSearchSchema } from "@/features/users";

export const Route = createFileRoute("/_auth/_org/usuarios/")({
  validateSearch: userSearchSchema,
  search: { middlewares: [stripSearchParams(userSearchDefaults)] },
  component: RouteComponent,
});

function RouteComponent() {
  return <UsersPage search={Route.useSearch()} />;
}
