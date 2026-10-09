/** How long the object URL stays alive after the click, so the browser can start the download. */
const REVOKE_DELAY_MS = 1000;

/** The browser effects of a download, injectable so the sequence is testable without a DOM. */
export type FileDownloadEnv = {
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
  /** Starts the download of `url` as `filename` (a clicked `<a download>`). */
  trigger: (url: string, filename: string) => void;
  /** Runs `callback` later; the URL is revoked there, never synchronously after `trigger`. */
  schedule: (callback: () => void) => void;
};

function browserEnv(): FileDownloadEnv {
  return {
    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
    trigger: (url, filename) => {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
    },
    schedule: (callback) => {
      setTimeout(callback, REVOKE_DELAY_MS);
    },
  };
}

/**
 * Saves `file` through the browser's download flow (a temporary object URL and anchor click).
 * Revoking the URL right after the click can cancel the download in some browsers, so it is
 * deferred through `env.schedule`.
 */
export function downloadFile(
  file: Blob,
  fallbackName: string,
  env: FileDownloadEnv = browserEnv(),
): void {
  const name = file instanceof File && file.name ? file.name : fallbackName;
  const url = env.createObjectURL(file);
  env.trigger(url, name);
  env.schedule(() => env.revokeObjectURL(url));
}
