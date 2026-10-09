import { Card, CardContent } from "@base-template/ui/components/card";
import { Progress, ProgressLabel, ProgressValue } from "@base-template/ui/components/progress";

import { importProgressLabel, importProgressPercent } from "../lib/user-import";

/** USR-04 progress while the import runs: "Importando… {processed} de {total}". Presentational. */
export default function ImportProgressCard({
  processed,
  total,
}: {
  processed: number;
  total: number;
}) {
  return (
    <Card>
      <CardContent>
        <Progress value={importProgressPercent(processed, total)} aria-live="polite">
          <ProgressLabel>{importProgressLabel(processed, total)}</ProgressLabel>
          <ProgressValue />
        </Progress>
      </CardContent>
    </Card>
  );
}
