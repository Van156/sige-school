import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { orpc } from "@/app/orpc";

import { importPollInterval, isImportTerminal } from "../lib/user-import";
import type { ImportJob } from "../types";

/**
 * Progress of a started import (USR-R12): polls `importJob.get` every 2 s until the job is `done`
 * or `failed`, then refreshes the user lists once so USR-01 shows the new users. Idle while
 * `jobId` is `null`.
 */
export function useImportJob(jobId: string | null) {
  const queryClient = useQueryClient();
  const query = useQuery({
    ...orpc.importJob.get.queryOptions({ input: { jobId: jobId ?? "" } }),
    enabled: jobId !== null,
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: (state) => importPollInterval(state.state.data?.status),
  });

  const job: ImportJob | undefined = query.data;
  const finished = isImportTerminal(job?.status);
  useEffect(() => {
    if (finished) {
      void queryClient.invalidateQueries({ queryKey: orpc.user.key() });
    }
  }, [finished, queryClient]);

  return { job, isError: query.isError && job === undefined, refetch: query.refetch };
}
