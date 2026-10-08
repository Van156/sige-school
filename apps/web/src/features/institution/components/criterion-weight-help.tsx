import { formatWeight } from "../lib/criterion-list";
import { HelpCard } from "./form-page-layout";

const DEFAULT_SET = [
  { name: "Seguimiento", weight: 20 },
  { name: "Formativo", weight: 20 },
  { name: "Cognitivo", weight: 30 },
  { name: "Procedimental", weight: 30 },
] as const;

/** INS-18 side card: the recommended default set and the live total with the criterion being typed. */
export default function CriterionWeightHelp({ total }: { total: number }) {
  return (
    <HelpCard title="Información">
      <p className="font-medium text-foreground">Criterios recomendados</p>
      <ul className="list-disc pl-5">
        {DEFAULT_SET.map((criterion) => (
          <li key={criterion.name}>
            {criterion.name} {formatWeight(criterion.weight)}
          </li>
        ))}
      </ul>
      <p className="font-medium text-foreground">Total con este criterio: {formatWeight(total)}</p>
      <p>Los pesos de todos los criterios deben sumar 100%.</p>
    </HelpCard>
  );
}
