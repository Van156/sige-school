import { Badge } from "@base-template/ui/components/badge";
import { Button } from "@base-template/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@base-template/ui/components/dialog";
import { Field, FieldLabel } from "@base-template/ui/components/field";
import { RadioGroup, RadioGroupItem } from "@base-template/ui/components/radio-group";
import { Textarea } from "@base-template/ui/components/textarea";
import { CircleCheck, Download, Eye, FileText, History, PackageCheck, Truck } from "lucide-react";
import { useState } from "react";

import { ConfirmDeleteButton } from "../../-components/confirm-delete";
import { EntityList } from "../../-components/entity-list";
import { FilterSelect } from "../../-components/filter-select";
import { SelectField } from "../../-components/form-fields";
import { IconLink } from "../../-components/icon-link";
import { ScopedPage } from "../../-components/scoped-page";
import { SectionCard } from "../../-components/section-card";
import { StatGrid, StatTile } from "../../-components/stat-tile";
import type { TableColumn } from "../../-components/simple-table";
import { ToneBadge } from "../../-components/tone-badge";
import { formatDateTime } from "../../-lib/format";
import { gradeOptions } from "../../-lib/school-options";
import { useGrading, type Grading } from "../../-lib/use-grading";
import { useRole } from "../../-lib/use-role";
import { useSchool, type School } from "../../-lib/use-school";
import {
  currentUserFor,
  deleteReportCard,
  generateReportCard,
  generateReportCards,
  mockAction,
  mockError,
  mockInfo,
  setReportDelivery,
  type BulkReportEntry,
} from "../../-mock";
import type { DeliveryStatus, Institution, ReportCard } from "../../-mock/types";

const MAX_LISTED = 20;

/** RPT-01: generate report cards (individual and by course), review them and set their delivery. */
export function ReportCardsScreen() {
  return (
    <ScopedPage
      screenId="RPT-01"
      title="Gestión de Boletines de Calificaciones"
      description="Genera, revisa y entrega los boletines por periodo"
      target="Boletines"
      banner={false}
    >
      {(institution) => <ManageView institution={institution} />}
    </ScopedPage>
  );
}

function ManageView({ institution }: { institution: Institution }) {
  const school = useSchool(institution.id);
  const grading = useGrading(institution.id);
  const role = useRole();
  const userId = currentUserFor(role).id;
  const [delivery, setDelivery] = useState<ReportCard | null>(null);
  const [bulk, setBulk] = useState<BulkReportEntry[] | null>(null);

  const studentIds = new Set(school.students.map((student) => student.id));
  const cards = grading.cards
    .filter((card) => studentIds.has(card.studentId))
    .toSorted((a, b) => b.id - a.id);
  const delivered = cards.filter((card) => card.deliveryStatus === "entregado").length;

  return (
    <>
      <StatGrid columns={3}>
        <StatTile label="Total Generados" value={cards.length} icon={FileText} />
        <StatTile label="Entregados" value={delivered} icon={PackageCheck} tone="success" />
        <StatTile label="Pendientes" value={cards.length - delivered} icon={Truck} tone="warning" />
      </StatGrid>

      <SectionCard title="Generar Boletines">
        <div className="grid gap-4 lg:grid-cols-2">
          <IndividualForm school={school} grading={grading} userId={userId} />
          <BulkForm school={school} grading={grading} userId={userId} onResult={setBulk} />
        </div>
      </SectionCard>

      <CardsTable school={school} grading={grading} cards={cards} onDeliver={setDelivery} />

      <DeliveryDialog card={delivery} school={school} onClose={() => setDelivery(null)} />
      <BulkDialog result={bulk} school={school} onClose={() => setBulk(null)} />
    </>
  );
}

function IndividualForm({
  school,
  grading,
  userId,
}: {
  school: School;
  grading: Grading;
  userId: number;
}) {
  const [gradeId, setGradeId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [periodId, setPeriodId] = useState("");
  const students = school.students.filter(
    (student) => String(student.gradeId) === gradeId && student.status === "activo",
  );

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <h3 className="text-sm font-semibold">Boletín Individual</h3>
      <SelectField
        label="Grado"
        id="rpt-grade"
        value={gradeId}
        onValueChange={(value) => {
          setGradeId(value);
          setStudentId("");
        }}
        options={gradeOptions(school.grades)}
        placeholder="Seleccione un grado..."
      />
      <SelectField
        label="Estudiante"
        id="rpt-student"
        value={studentId}
        onValueChange={setStudentId}
        disabled={!gradeId}
        options={students.map((student) => ({
          value: String(student.id),
          label: school.userName(student.userId) ?? "Estudiante",
        }))}
        placeholder="Seleccione un estudiante..."
      />
      <SelectField
        label="Periodo Académico"
        id="rpt-period"
        value={periodId}
        onValueChange={setPeriodId}
        options={grading.periods.map((period) => ({
          value: String(period.id),
          label: `${period.name} (${period.academicYear})`,
        }))}
        placeholder="Seleccione un periodo..."
      />
      <div>
        <Button
          disabled={!gradeId || !studentId || !periodId}
          onClick={() => {
            const result = generateReportCard({
              studentId: Number(studentId),
              periodId: Number(periodId),
              generatedBy: userId,
            });
            if (result.ok) {
              mockAction(
                result.regenerated ? "Boletín regenerado" : "Boletín generado exitosamente.",
              );
            } else {
              mockError("No se pudo generar el boletín", result.reason);
            }
          }}
        >
          Generar Boletín
        </Button>
      </div>
    </div>
  );
}

function BulkForm({
  school,
  grading,
  userId,
  onResult,
}: {
  school: School;
  grading: Grading;
  userId: number;
  onResult: (entries: BulkReportEntry[]) => void;
}) {
  const [gradeId, setGradeId] = useState("");
  const [periodId, setPeriodId] = useState("");

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <h3 className="text-sm font-semibold">Generación Masiva por Grado</h3>
      <SelectField
        label="Grado"
        id="rpt-bulk-grade"
        value={gradeId}
        onValueChange={setGradeId}
        options={gradeOptions(school.grades)}
        placeholder="Seleccione un grado..."
      />
      <SelectField
        label="Periodo Académico"
        id="rpt-bulk-period"
        value={periodId}
        onValueChange={setPeriodId}
        options={grading.periods.map((period) => ({
          value: String(period.id),
          label: `${period.name} (${period.academicYear})`,
        }))}
        placeholder="Seleccione un periodo..."
      />
      <div>
        <Button
          disabled={!gradeId || !periodId}
          onClick={() =>
            onResult(
              generateReportCards({
                gradeId: Number(gradeId),
                periodId: Number(periodId),
                generatedBy: userId,
              }),
            )
          }
        >
          Generar Todos los Boletines
        </Button>
      </div>
    </div>
  );
}

function CardsTable({
  school,
  grading,
  cards,
  onDeliver,
}: {
  school: School;
  grading: Grading;
  cards: readonly ReportCard[];
  onDeliver: (card: ReportCard) => void;
}) {
  const [periodFilter, setPeriodFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const nameOf = (card: ReportCard) => school.studentName(card.studentId);
  const gradeOf = (card: ReportCard) =>
    school.gradeName(school.studentById.get(card.studentId)?.gradeId);
  const periodOf = (card: ReportCard) => grading.periodById.get(card.periodId)?.shortName ?? "-";

  const rows = cards.filter(
    (card) =>
      (!periodFilter || String(card.periodId) === periodFilter) &&
      (!gradeFilter || String(school.studentById.get(card.studentId)?.gradeId) === gradeFilter) &&
      (!statusFilter || card.deliveryStatus === statusFilter),
  );

  const columns: TableColumn<ReportCard>[] = [
    {
      key: "id",
      header: "ID",
      sortValue: (card) => card.id,
      cell: (card) => <span className="tabular-nums">{card.id}</span>,
    },
    { key: "student", header: "Estudiante", sortValue: nameOf, cell: nameOf },
    {
      key: "grade",
      header: "Grado",
      sortValue: (card) => gradeOf(card) ?? "",
      cell: (card) => gradeOf(card) ?? "N/A",
    },
    {
      key: "period",
      header: "Periodo",
      sortValue: (card) => card.periodId,
      cell: (card) => <Badge variant="outline">{periodOf(card)}</Badge>,
    },
    {
      key: "generated",
      header: "Generado",
      sortValue: (card) => card.generatedAt,
      cell: (card) => <span className="tabular-nums">{formatDateTime(card.generatedAt)}</span>,
    },
    {
      key: "delivery",
      header: "Entrega",
      sortValue: (card) => card.deliveryStatus,
      cell: (card) => (
        <ToneBadge tone={card.deliveryStatus === "entregado" ? "success" : "warning"}>
          {card.deliveryStatus === "entregado" ? "Entregado" : "Pendiente"}
        </ToneBadge>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Acciones</span>,
      className: "w-44",
      cell: (card) => {
        const name = nameOf(card);
        return (
          <div className="flex items-center justify-end gap-0.5">
            <IconLink
              screenId="RPT-04"
              search={{ id: String(card.id) }}
              label={`Ver boletín de ${name}`}
            >
              <Eye />
            </IconLink>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Descargar boletín de ${name}`}
              title="Descargar"
              onClick={() =>
                mockInfo(
                  "Descargar PDF",
                  "Abre la vista del boletín y usa Imprimir > Guardar como PDF.",
                )
              }
            >
              <Download />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Estado de entrega de ${name}`}
              title="Estado de entrega"
              onClick={() => onDeliver(card)}
            >
              <Truck />
            </Button>
            <IconLink
              screenId="RPT-03"
              search={{ student: String(card.studentId) }}
              label={`Historial de boletines de ${name}`}
            >
              <History />
            </IconLink>
            <ConfirmDeleteButton
              label={`Eliminar boletín de ${name}`}
              title="¿Eliminar este boletín?"
              description="Esta acción no se puede deshacer."
              onConfirm={() => {
                deleteReportCard(card.id);
                mockAction(
                  "Boletín eliminado",
                  `El boletín de ${name} se eliminó de los datos en memoria.`,
                );
              }}
            />
          </div>
        );
      },
    },
  ];

  return (
    <EntityList
      title="Boletines Generados"
      columns={columns}
      rows={rows}
      getRowId={(card) => card.id}
      searchText={(card) => [nameOf(card), gradeOf(card), periodOf(card)]}
      searchPlaceholder="Buscar estudiante o grado"
      emptyIcon={<FileText />}
      emptyTitle="No hay boletines generados aún."
      emptyDescription="Genera el primer boletín con los formularios de arriba."
      filters={
        <>
          <FilterSelect
            label="Filtrar por periodo"
            value={periodFilter}
            onValueChange={setPeriodFilter}
            options={grading.periods.map((period) => ({
              value: String(period.id),
              label: period.shortName,
            }))}
            allLabel="Todos los periodos"
          />
          <FilterSelect
            label="Filtrar por grado"
            value={gradeFilter}
            onValueChange={setGradeFilter}
            options={gradeOptions(school.grades)}
            allLabel="Todos los grados"
          />
          <FilterSelect
            label="Filtrar por entrega"
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={[
              { value: "entregado", label: "Entregados" },
              { value: "pendiente", label: "Pendientes" },
            ]}
            allLabel="Toda entrega"
          />
        </>
      }
    />
  );
}

function DeliveryDialog({
  card,
  school,
  onClose,
}: {
  card: ReportCard | null;
  school: School;
  onClose: () => void;
}) {
  return (
    <Dialog open={card !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        {card ? <DeliveryForm key={card.id} card={card} school={school} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function DeliveryForm({
  card,
  school,
  onClose,
}: {
  card: ReportCard;
  school: School;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<DeliveryStatus>(card.deliveryStatus);
  const [observation, setObservation] = useState(card.generalObservation ?? "");

  return (
    <>
      <DialogHeader>
        <DialogTitle>Estado de Entrega</DialogTitle>
        <DialogDescription>
          Estudiante: <strong>{school.studentName(card.studentId)}</strong>
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        <RadioGroup
          aria-label="Cambiar estado a"
          value={status}
          onValueChange={(value) => setStatus(value as DeliveryStatus)}
        >
          {(
            [
              ["entregado", "Entregado"],
              ["pendiente", "Pendiente"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              htmlFor={`delivery-${value}`}
              className="flex items-center gap-2 text-sm"
            >
              <RadioGroupItem id={`delivery-${value}`} value={value} />
              {label}
            </label>
          ))}
        </RadioGroup>
        <Field>
          <FieldLabel htmlFor="delivery-observation">Observación general</FieldLabel>
          <Textarea
            id="delivery-observation"
            rows={3}
            value={observation}
            onChange={(event) => setObservation(event.target.value)}
          />
        </Field>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          onClick={() => {
            setReportDelivery({
              cardId: card.id,
              status,
              generalObservation: observation.trim() || undefined,
            });
            mockAction("Estado de entrega actualizado");
            onClose();
          }}
        >
          Guardar
        </Button>
      </DialogFooter>
    </>
  );
}

const OUTCOME_LABEL = { generado: "generado", omitido: "omitido", error: "error" } as const;

function BulkDialog({
  result,
  school,
  onClose,
}: {
  result: BulkReportEntry[] | null;
  school: School;
  onClose: () => void;
}) {
  const count = (outcome: BulkReportEntry["outcome"]) =>
    result?.filter((entry) => entry.outcome === outcome).length ?? 0;
  const listed = result?.slice(0, MAX_LISTED) ?? [];
  const hidden = (result?.length ?? 0) - listed.length;

  return (
    <Dialog open={result !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resultado de Generación Masiva</DialogTitle>
          <DialogDescription>Resumen de los boletines procesados.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-4 gap-2 text-center">
          {(
            [
              ["Total", result?.length ?? 0],
              ["Generados", count("generado")],
              ["Omitidos", count("omitido")],
              ["Errores", count("error")],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded-lg border p-2">
              <div className="text-xl font-semibold tabular-nums">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
        <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto text-[13px]">
          {listed.map((entry) => (
            <li key={entry.studentId} className="flex items-start gap-2">
              {entry.outcome === "generado" ? (
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" />
              ) : (
                <span aria-hidden="true" className="w-4 shrink-0 text-center text-muted-foreground">
                  {entry.outcome === "omitido" ? "–" : "✗"}
                </span>
              )}
              <span>
                {school.studentName(entry.studentId)}: {OUTCOME_LABEL[entry.outcome]}
                {entry.reason ? ` (${entry.reason})` : ""}
              </span>
            </li>
          ))}
          {hidden > 0 ? <li className="text-muted-foreground">... y {hidden} más</li> : null}
        </ul>
        <DialogFooter>
          <Button onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
