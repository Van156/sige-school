import { Button } from "@base-template/ui/components/button";
import { Download } from "lucide-react";

/** "Descargar Plantilla" of an import screen. Presentational: the container runs the download. */
export default function TemplateDownloadButton({
  isDownloading = false,
  onDownload,
  size,
}: {
  isDownloading?: boolean;
  onDownload: () => void;
  size?: "default" | "sm";
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      disabled={isDownloading}
      onClick={onDownload}
    >
      <Download data-icon="inline-start" />
      Descargar Plantilla
    </Button>
  );
}
