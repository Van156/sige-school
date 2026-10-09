import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { orpc } from "@/app/orpc";
import { downloadFile } from "@/shared/lib/download-file";

const TEMPLATE_FILENAME = "plantilla-usuarios.xlsx";

/** "Descargar Plantilla": fetches `user.importTemplate` and saves it. */
export function useImportTemplate() {
  const mutation = useMutation({
    ...orpc.user.importTemplate.mutationOptions(),
    onSuccess: (file) => downloadFile(file, TEMPLATE_FILENAME),
    onError: () => toast.error("No se pudo descargar la plantilla."),
  });
  return { download: () => mutation.mutate(undefined), isPending: mutation.isPending };
}
