import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

/**
 * Container logic shared by the scheduling form pages: runs a save, then reports it (a success
 * toast, or whatever `report` does with the save's result), refreshes the queries under
 * `invalidate` and returns to the list at `to`. A rejected save propagates to the form, which maps
 * the server error onto its fields.
 */
export function useSaveAndReturn({
  invalidate,
  to,
}: {
  /** Query key of the entity (its list, stats and rows) the save makes stale. */
  invalidate: QueryKey;
  to: "/salones" | "/bloques" | "/materias-por-grado";
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return async <TResult>(
    run: () => Promise<TResult>,
    report: string | ((result: TResult) => void),
  ) => {
    const result = await run();
    if (typeof report === "string") {
      toast.success(report);
    } else {
      report(result);
    }
    await queryClient.invalidateQueries({ queryKey: invalidate });
    await navigate({ to });
  };
}
