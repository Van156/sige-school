import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { orpc } from "@/app/orpc";

import { createFinishNotifier, isJobNotFound } from "../lib/import-flow";
import { importPollInterval } from "../lib/user-import";
import type { ImportJob } from "../types";

/**
 * Progress of a started import (USR-R12): polls `importJob.get` every 2 s until the job is `done`
 * or `failed`, then refreshes the user lists once per job so USR-01 shows the new users. Idle
 * while `jobId` is `null`. `notFound` flags a job that no longer exists (purged, or a stale URL).
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
  const notifier = useMemo(
    () =>
      createFinishNotifier(() => void queryClient.invalidateQueries({ queryKey: orpc.user.key() })),
    [queryClient],
  );
  const status = job?.status;
  useEffect(() => {
    notifier.observe(jobId, status);
  }, [notifier, jobId, status]);

  const failed = query.isError && job === undefined;
  return {
    job,
    isError: failed && !isJobNotFound(query.error),
    notFound: failed && isJobNotFound(query.error),
    refetch: query.refetch,
  };
}
