import { useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useEffect, useEffectEvent, useState } from "react";

import { orpc } from "@/app/orpc";
import { isNotFoundError } from "@/shared/lib/orpc-error";

import { createFinishNotifier } from "../lib/import-flow";
import { importPollInterval } from "../lib/excel-import";
import type { ImportJob } from "../types";

/**
 * Progress of a started import (USR-R12): polls `importJob.get` every 2 s until the job is `done`
 * or `failed`, then invalidates `invalidate` once per job so the entity lists show the new rows.
 * Idle while `jobId` is `null`. `notFound` flags a job that no longer exists (purged, or a stale
 * URL).
 */
export function useImportJob(jobId: string | null, invalidate: QueryKey) {
  const queryClient = useQueryClient();
  const query = useQuery({
    ...orpc.importJob.get.queryOptions({ input: { jobId: jobId ?? "" } }),
    enabled: jobId !== null,
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: (state) => importPollInterval(state.state.data?.status),
  });

  const job: ImportJob | undefined = query.data;
  // `refresh` reads the latest key; the notifier itself lives as long as the screen.
  const refresh = useEffectEvent(() => {
    void queryClient.invalidateQueries({ queryKey: invalidate });
  });
  const [notifier] = useState(() => createFinishNotifier(() => refresh()));
  const status = job?.status;
  useEffect(() => {
    notifier.observe(jobId, status);
  }, [notifier, jobId, status]);

  const failed = query.isError && job === undefined;
  return {
    job,
    isError: failed && !isNotFoundError(query.error),
    notFound: failed && isNotFoundError(query.error),
    refetch: query.refetch,
  };
}
