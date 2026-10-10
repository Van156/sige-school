import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { downloadFile } from "@/shared/lib/download-file";

/**
 * "Descargar Plantilla": fetches the entity's template (`user.importTemplate`,
 * `student.importTemplate`) through `fetchTemplate` and saves it as `filename`.
 */
export function useImportTemplate({
  fetchTemplate,
  filename,
}: {
  fetchTemplate: () => Promise<File>;
  filename: string;
}) {
  const mutation = useMutation({
    mutationFn: fetchTemplate,
    onSuccess: (file) => downloadFile(file, filename),
    onError: () => toast.error("No se pudo descargar la plantilla."),
  });
  return { download: () => mutation.mutate(), isPending: mutation.isPending };
}
