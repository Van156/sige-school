/** Saves `file` through the browser's download flow (a temporary object URL and anchor click). */
export function downloadFile(file: Blob, fallbackName: string): void {
  const name = file instanceof File && file.name ? file.name : fallbackName;
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
