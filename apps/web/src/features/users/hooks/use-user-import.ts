import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { orpc } from "@/app/orpc";

import {
  IMPORT_PREVIEW_FALLBACK,
  IMPORT_START_FALLBACK,
  importErrorMessage,
  importPhase,
  validateImportFile,
} from "../lib/user-import";
import { useImportJob } from "./use-import-job";

/**
 * USR-04 flow (container logic): pick a file -> `user.importPreview` -> `user.importStart` ->
 * poll the job. The picked file is pre-checked client-side (the server stays authoritative);
 * `reset` returns to the empty picker. Each failure is exposed as the text to show.
 */
export function useUserImport() {
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const previewMutation = useMutation(orpc.user.importPreview.mutationOptions());
  const startMutation = useMutation(orpc.user.importStart.mutationOptions());
  const jobId = startMutation.data?.jobId ?? null;
  const jobState = useImportJob(jobId);

  const phase = importPhase({
    jobId,
    jobStatus: jobState.job?.status,
    startPending: startMutation.isPending,
    previewPending: previewMutation.isPending,
    hasPreview: previewMutation.isSuccess,
  });

  function select(picked: File | null) {
    startMutation.reset();
    previewMutation.reset();
    const invalid = picked ? validateImportFile(picked) : null;
    setFileError(invalid);
    if (!picked || invalid) {
      setFile(null);
      return;
    }
    setFile(picked);
    previewMutation.mutate({ file: picked });
  }

  function start() {
    if (file) {
      startMutation.mutate({ file });
    }
  }

  function reset() {
    startMutation.reset();
    previewMutation.reset();
    setFile(null);
    setFileError(null);
  }

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
    select,
    start,
    reset,
  };
}
