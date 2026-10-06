import { Badge } from "@base-template/ui/components/badge";
import { Button } from "@base-template/ui/components/button";
import { Field, FieldLabel } from "@base-template/ui/components/field";
import { NativeSelect, NativeSelectOption } from "@base-template/ui/components/native-select";
import { Play } from "lucide-react";
import { useState } from "react";

import { ConfirmActionButton } from "../../-components/confirm-action";
import { BackButton } from "../../-components/form-layout";
import { ScreenLinkButton } from "../../-components/link-button";
import { ScopedPage } from "../../-components/scoped-page";
import { SectionCard } from "../../-components/section-card";
import { SimpleTable, type TableColumn } from "../../-components/simple-table";
import { SeverityBadge } from "../../-components/tone-badge";
import {
  ALERT_RULES,
  ALERT_TYPE_LABEL,
  mockAction,
  runAlertRule,
  runAllAlertRules,
  type AlertRule,
  type AlertRunResult,
} from "../../-mock";
import type { AlertType } from "../../-mock/types";

/** ALR-03: rule catalogue and runners (all rules or one); results show the alerts created. */
export function AlertEngineScreen() {
  const [results, setResults] = useState<AlertRunResult[] | null>(null);
  const [selected, setSelected] = useState("");

  const finish = (next: AlertRunResult[]) => {
    setResults(next);
    const total = next.reduce((sum, entry) => sum + entry.created, 0);
    mockAction(
      total > 0 ? `Motor ejecutado: ${total} alertas nuevas` : "Motor ejecutado",
      total === 0 ? "No se encontraron nuevas alertas (no se duplican las activas)." : undefined,
    );
  };

  const columns: TableColumn<AlertRule>[] = [
    {
      key: "rule",
      header: "Alerta",
      cell: (row) => <span className="font-medium">{row.label}</span>,
    },
    { key: "condition", header: "Condición", cell: (row) => row.condition },
    {
      key: "severity",
      header: "Severidad",
      cell: (row) => <SeverityBadge severity={row.severity} />,
    },
  ];

  return (
    <ScopedPage
      screenId="ALR-03"
      title="Ejecutar Motor de Alertas"
      description="Evalúa las reglas sobre las notas y la asistencia actuales"
      target="Alertas"
      banner={false}
      back={<BackButton screenId="ALR-01" label="Volver al listado" />}
    >
      {() => (
        <>
          <SectionCard title="Reglas del Motor de Alertas">
            <SimpleTable columns={columns} rows={ALERT_RULES} getRowId={(row) => row.type} />
          </SectionCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Ejecutar Todas las Reglas">
              <p className="text-[13px] text-muted-foreground">
                Ejecuta las 6 reglas de alerta simultáneamente.
              </p>
              <div>
                <ConfirmActionButton
                  variant="default"
                  title="Ejecutar el motor completo"
                  description="Se ejecutarán todas las reglas de alerta. ¿Deseas continuar?"
                  confirmLabel="Ejecutar"
                  onConfirm={() => finish(runAllAlertRules())}
                >
                  <Play data-icon="inline-start" />
                  Ejecutar Motor Completo
                </ConfirmActionButton>
              </div>
            </SectionCard>

            <SectionCard title="Ejecutar Regla Individual">
              <Field>
                <FieldLabel htmlFor="alert-rule">Seleccionar Regla</FieldLabel>
                <NativeSelect
                  id="alert-rule"
                  value={selected}
                  className="w-full"
                  onChange={(event) => setSelected(event.target.value)}
                >
                  <NativeSelectOption value="">-- Selecciona una regla --</NativeSelectOption>
                  {ALERT_RULES.map((rule) => (
                    <NativeSelectOption key={rule.type} value={rule.type}>
                      {rule.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <div>
                <Button
                  disabled={!selected}
                  onClick={() => {
                    const type = selected as AlertType;
                    finish([{ type, created: runAlertRule(type) }]);
                  }}
                >
                  Ejecutar Regla
                </Button>
              </div>
            </SectionCard>
          </div>

          {results ? (
            <SectionCard
              title="Resultados de la Ejecución"
              action={
                <ScreenLinkButton screenId="ALR-01" size="sm" variant="default">
                  Ver Alertas Generadas
                </ScreenLinkButton>
              }
            >
              <ul className="flex flex-col divide-y text-[13px]">
                {results.map((entry) => (
                  <li key={entry.type} className="flex items-center justify-between gap-2 py-2">
                    <span>{ALERT_TYPE_LABEL[entry.type]}</span>
                    <Badge variant={entry.created > 0 ? "success" : "secondary"}>
                      {entry.created} alertas
                    </Badge>
                  </li>
                ))}
              </ul>
            </SectionCard>
          ) : null}
        </>
      )}
    </ScopedPage>
  );
}
