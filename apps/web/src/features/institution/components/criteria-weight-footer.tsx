import { Alert, AlertDescription, AlertTitle } from "@base-template/ui/components/alert";
import { TriangleAlert } from "lucide-react";

import { formatWeight, weightsNeedWarning } from "../lib/criterion-list";

/**
 * INS-17 footer (INS-R7): "Peso total: {n}%" when Σ = 100, else the "Los pesos suman {n}%" callout.
 * Saving never blocks on it. Presentational: `totalWeight` is the API's exact sum.
 */
export default function CriteriaWeightFooter({
  count,
  totalWeight,
}: {
  count: number;
  totalWeight: number;
}) {
  if (!weightsNeedWarning(count, totalWeight)) {
    return <p className="text-sm font-medium">Peso total: {formatWeight(totalWeight)}</p>;
  }
  return (
    <Alert>
      <TriangleAlert />
      <AlertTitle>Los pesos suman {formatWeight(totalWeight)}</AlertTitle>
      <AlertDescription>
        Los pesos de los criterios deben sumar 100% para calcular bien las notas finales.
      </AlertDescription>
    </Alert>
  );
}
