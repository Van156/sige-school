import { Alert, AlertDescription } from "@base-template/ui/components/alert";
import { TriangleAlert } from "lucide-react";

/** INS-R5 callout of the INS-15 list: "Este año tiene {n} de 4 periodos." A warning, not a limit. */
export default function PeriodCountWarning({ message }: { message: string }) {
  return (
    <Alert>
      <TriangleAlert />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
