import { useMutation, type QueryKey } from "@tanstack/react-query";
import { useEffect, useEffectEvent, useState } from "react";

import {
  leaveMissingJob,
  recordStartedJob,
  resetImport,
  selectImportFile,
} from "../lib/import-flow";
import {
  IMPORT_PREVIEW_FALLBACK,
  IMPORT_START_FALLBACK,
  importErrorMessage,
  importPhase,
} from "../lib/excel-import";
import type { ImportPreview, ImportPreviewRowBase } from "../types";
import { useImportJob } from "./use-import-job";

/** The entity's import procedures (e.g. `orpc.student.importPreview.call`). */
export type ImportProcedures<TRow extends ImportPreviewRowBase> = {
  preview: (input: { file: File }) => Promise<ImportPreview<TRow>>;
  start: (input: { file: File }) => Promise<{ jobId: string }>;
  /** Query key the finished job makes stale (the entity lists). */
  invalidate: QueryKey;
};

/**
 * Excel import flow (container logic of USR-04 and STU-05): pick a file -> `importPreview` ->
 * `importStart` -> poll the job. The running job id lives in the URL (`jobId`, changed through
 * `onJobChange`), so a reload resumes polling it; a job that no longer exists returns to the
 * picker. The picked file is pre-checked client-side (the server stays authoritative); `reset`
 * returns to the empty picker. Each failure is exposed as the text to show. The orchestration
 * itself is in `lib/import-flow`.
 */
export function useImportFlow<TRow extends ImportPreviewRowBase>({
  jobId,
  onJobChange,
  procedures,
}: {
  jobId: string | null;
  onJobChange: (jobId: string | null) => void;
  procedures: ImportProcedures<TRow>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const previewMutation = useMutation({ mutationFn: procedures.preview });
  const startMutation = useMutation({
    mutationFn: procedures.start,
    onSuccess: (started) => recordStartedJob(started, onJobChange),
  });
  const jobState = useImportJob(jobId, procedures.invalidate);

  const effects = {
    resetStart: () => {
      startMutation.reset();
      onJobChange(null);
    },
    resetPreview: () => previewMutation.reset(),
    setFile,
    setFileError,
  };

  // The URL points at a job the server no longer has: back to the picker.
  const { notFound } = jobState;
  const backToPicker = useEffectEvent(() => leaveMissingJob(notFound, effects));
  useEffect(() => {
    backToPicker();
  }, [notFound]);

  const phase = importPhase({
    jobId,
    jobStatus: jobState.job?.status,
    // The job id reaches the URL a moment after `importStart` resolves: stay in "running".
    startPending: startMutation.isPending || (startMutation.isSuccess && jobId === null),
    previewPending: previewMutation.isPending,
    hasPreview: previewMutation.isSuccess,
  });

  const previewError = previewMutation.isError
    ? importErrorMessage(previewMutation.error, IMPORT_PREVIEW_FALLBACK)
    : null;
  const startError = startMutation.isError
    ? importErrorMessage(startMutation.error, IMPORT_START_FALLBACK)
    : null;

  return {
    phase,
    file,
    fileError: fileError ?? previewError,
    startError,
    preview: previewMutation.data,
    job: jobState.job,
    jobLoadFailed: jobState.isError,
    retryJob: () => void jobState.refetch(),
    select: (picked: File | null) =>
      selectImportFile(picked, {
        ...effects,
        requestPreview: (next) => previewMutation.mutate({ file: next }),
      }),
    start: () => {
      if (file) {
        startMutation.mutate({ file });
      }
    },
    reset: () => resetImport(effects),
  };
}
