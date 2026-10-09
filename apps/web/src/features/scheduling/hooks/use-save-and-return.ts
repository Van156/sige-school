import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

/**
 * Container logic shared by the scheduling form pages: runs a save, then toasts, refreshes the
 * queries under `invalidate` and returns to the list at `to`. A rejected save propagates to the
 * form, which maps the server error onto its fields.
 */
export function useSaveAndReturn({
  invalidate,
  to,
}: {
  /** Query key of the entity (its list, stats and rows) the save makes stale. */
  invalidate: QueryKey;
  to: "/salones" | "/bloques";
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return async (run: () => Promise<unknown>, successMessage: string) => {
    await run();
    toast.success(successMessage);
    await queryClient.invalidateQueries({ queryKey: invalidate });
    await navigate({ to });
  };
}
