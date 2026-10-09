import { createFileRoute } from "@tanstack/react-router";

import { TimeBlocksPage } from "@/features/scheduling";

export const Route = createFileRoute("/_auth/_org/bloques/")({
  component: TimeBlocksPage,
});
