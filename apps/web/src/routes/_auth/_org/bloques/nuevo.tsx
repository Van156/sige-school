import { createFileRoute } from "@tanstack/react-router";

import { TimeBlockFormPage } from "@/features/scheduling";

export const Route = createFileRoute("/_auth/_org/bloques/nuevo")({
  component: () => <TimeBlockFormPage />,
});
