import { Badge } from "@base-template/ui/components/badge";
import { Button } from "@base-template/ui/components/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@base-template/ui/components/field";
import { Input } from "@base-template/ui/components/input";
import { CircleCheck, Download, FileSpreadsheet, Upload } from "lucide-react";
import { useState } from "react";

import { Callout } from "../../-components/callout";
import { SelectField } from "../../-components/form-fields";
import { BackButton } from "../../-components/form-layout";
import { ScreenLinkButton } from "../../-components/link-button";
import { ScopedPage } from "../../-components/scoped-page";
import { GradeScaleLegend } from "../../-components/score-badge";
import { SectionCard } from "../../-components/section-card";
import { SimpleTable, type TableColumn } from "../../-components/simple-table";
import { ToneBadge } from "../../-components/tone-badge";
import { useAccessibleSubjectGrades, useGrading } from "../../-lib/use-grading";
import { useSchool } from "../../-lib/use-school";
import { useStringParam } from "../../-lib/use-search-params";
import { MAX_GRADE, MIN_GRADE, mockInfo, saveGradeCells } from "../../-mock";
import type { GradeCriteria, Institution } from "../../-mock/types";

interface SheetRow {
  document: string;
  /** Raw cell text per criterion id, as typed in the workbook. */
  scores: Record<number, string>;
}

/**
 * Fixed content of the "uploaded" workbook: the first students of the course with plausible
 * scores, one row with an out-of-range score and one with a document that is not in the course.
 */
function buildSheet(documents: readonly string[], criteria: readonly GradeCriteria[]): SheetRow[] {
  const scoresFor = (index: number) =>
    Object.fromEntries(
      criteria.map((criterion) => [
        criterion.id,
        (3 + ((index * 7 + criterion.id * 3) % 20) / 10).toFixed(1),
      ]),
    );
  const rows = documents.slice(0, 6).map((document, index) => ({
    document,
    scores: scoresFor(index),
  }));
  const outOfRange = documents[6] ?? documents[0];
  if (outOfRange) {
    const first = criteria[0];
    rows.push({
      document: outOfRange,
      scores: { ...scoresFor(6), ...(first ? { [first.id]: "6.2" } : {}) },
    });
  }
  rows.push({ document: "9999999999", scores: scoresFor(8) });
  return rows;
}

interface CheckedRow {
  row: SheetRow;
  studentId: number | undefined;
  error: string | null;
}

function checkRow(
  row: SheetRow,
  studentByDocument: ReadonlyMap<string, number>,
  criteria: readonly GradeCriteria[],
): CheckedRow {
  const studentId = studentByDocument.get(row.document);
  if (studentId === undefined) {
    return { row, studentId, error: "Documento no encontrado en el curso." };
  }
  for (const criterion of criteria) {
    const value = Number(row.scores[criterion.id]);
    if (!Number.isFinite(value) || value < MIN_GRADE || value > MAX_GRADE) {
      return { row, studentId, error: `Nota fuera de rango (1.0 - 5.0) en ${criterion.name}.` };
    }
  }
  return { row, studentId, error: null };
}

/** GRD-03: bulk grade upload from an Excel sheet (mock preview, nothing is parsed). */
export function GradesUploadScreen() {
  return (
    <ScopedPage
      screenId="GRD-03"
      title="Carga Masiva de Notas desde Excel"
      description="Carga las notas de un grado y asignatura en un solo paso"
      target="Notas"
      banner={false}
      actions={<BackButton screenId="GRD-01" label="Volver a Selección" />}
    >
      {(institution) => <UploadView institution={institution} />}
    </ScopedPage>
  );
}

function UploadView({ institution }: { institution: Institution }) {
  const school = useSchool(institution.id);
  const grading = useGrading(institution.id);
  const access = useAccessibleSubjectGrades(school);
  const [subjectGradeId, setSubjectGradeId] = useState(useStringParam("sg") ?? "");
  const [periodId, setPeriodId] = useState(
    useStringParam("period") ?? String(grading.activePeriod?.id ?? ""),
  );
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<{
    created: number;
    updated: number;
    errors: string[];
  } | null>(null);

  const classOptions = access.list
    .map((item) => ({
      value: String(item.id),
      label: `${school.gradeName(item.gradeId) ?? "-"} · ${school.subjectName(item.subjectId)} - ${
        school.userName(item.teacherId) ?? "Sin docente"
      }`,
    }))
    .toSorted((a, b) => a.label.localeCompare(b.label, "es", { numeric: true }));

  const selected = access.list.find((item) => String(item.id) === subjectGradeId);
  const periodNumber = Number(periodId);
  const locked = selected !== undefined && grading.isLocked(selected.id, periodNumber);

  const courseStudents = selected
    ? school.students.filter(
        (student) => student.gradeId === selected.gradeId && student.status === "activo",
      )
    : [];
  const studentByDocument = new Map(
    courseStudents.flatMap((student) => {
      const user = school.userOfStudent(student);
      return user ? [[user.documentNumber, student.id] as const] : [];
    }),
  );
  const sheet = buildSheet([...studentByDocument.keys()], grading.criteria);
  const checked = sheet.map((row) => checkRow(row, studentByDocument, grading.criteria));
  const validCount = checked.filter(({ error }) => !error).length;

  const runUpload = () => {
    if (!selected || locked) return;
    let created = 0;
    let updated = 0;
    const errors: string[] = [];
    checked.forEach(({ row, studentId, error }, index) => {
      if (error || studentId === undefined) {
        errors.push(`Fila ${index + 2}: ${error}`);
        return;
      }
      const cells = grading.criteria.map((criterion) => {
        const existing = grading
          .recordsOf(studentId, selected.id, periodNumber)
          .find((record) => record.criterionId === criterion.id);
        if (existing) updated += 1;
        else created += 1;
        return {
          studentId,
          criterionId: criterion.id,
          score: Number(row.scores[criterion.id]),
          observation: existing?.observation,
        };
      });
      saveGradeCells({
        subjectGradeId: selected.id,
        periodId: periodNumber,
        userId: access.userId,
        cells,
      });
    });
    setResult({ created, updated, errors });
  };

  const reset = () => {
    setFileName(null);
    setResult(null);
  };

  const columns: TableColumn<CheckedRow>[] = [
    {
      key: "document",
      header: "documento",
      cell: ({ row }) => <span className="font-mono text-xs">{row.document}</span>,
    },
    ...grading.criteria.map((criterion): TableColumn<CheckedRow> => ({
      key: String(criterion.id),
      header: criterion.name.toLowerCase(),
      align: "center",
      cell: ({ row }) => <span className="tabular-nums">{row.scores[criterion.id]}</span>,
    })),
    {
      key: "status",
      header: "Estado",
      cell: ({ error }) =>
        error ? (
          <ToneBadge tone="destructive">{error}</ToneBadge>
        ) : (
          <ToneBadge tone="success">Válida</ToneBadge>
        ),
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">
        {result ? (
          <UploadResult
            result={result}
            onReset={reset}
            search={{ sg: subjectGradeId, period: periodId }}
          />
        ) : (
          <SectionCard title="Cargar Archivo">
            <FieldGroup>
              <SelectField
                label="Grado y Asignatura"
                required
                id="grd-upload-class"
                value={subjectGradeId}
                onValueChange={setSubjectGradeId}
                options={classOptions}
                placeholder="-- Seleccionar --"
              />
              <SelectField
                label="Periodo Académico"
                required
                id="grd-upload-period"
                value={periodId}
                onValueChange={setPeriodId}
                options={grading.periods.map((period) => ({
                  value: String(period.id),
                  label: period.isActive ? `${period.name} (activo)` : period.name,
                }))}
              />
              <Field>
                <FieldLabel htmlFor="grd-upload-file">Archivo Excel (.xlsx, .xls) *</FieldLabel>
                <Input
                  id="grd-upload-file"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
                />
                <FieldDescription>
                  El prototipo no lee el contenido: muestra una hoja de ejemplo del grado elegido.
                </FieldDescription>
              </Field>
            </FieldGroup>
            {locked ? (
              <Callout tone="destructive" title="Periodo bloqueado">
                Las notas de este periodo están cerradas. Desbloquéalas en el panel de bloqueo antes
                de cargar el archivo.
              </Callout>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button disabled={!selected || fileName === null || locked} onClick={runUpload}>
                <Upload data-icon="inline-start" />
                Cargar Notas
              </Button>
              <Button variant="outline" onClick={reset}>
                Limpiar
              </Button>
            </div>
          </SectionCard>
        )}

        {fileName && selected && !result ? (
          <SectionCard
            title="Vista previa"
            description={`${fileName} · ${checked.length} filas, ${validCount} válidas`}
          >
            <SimpleTable columns={columns} rows={checked} getRowId={({ row }) => row.document} />
          </SectionCard>
        ) : null}
      </div>

      <div className="flex flex-col gap-4">
        <SectionCard title="Instrucciones">
          <ol className="ml-4 flex list-decimal flex-col gap-1 text-[13px] text-muted-foreground">
            <li>Selecciona el grado y la asignatura.</li>
            <li>Selecciona el periodo académico.</li>
            <li>
              Prepara un archivo .xlsx o .xls con la columna <code>documento</code> y una columna
              por criterio (escala 1.0 a 5.0).
            </li>
            <li>El sistema busca al estudiante por documento dentro del grado elegido.</li>
            <li>
              Las notas fuera de rango se rechazan; las existentes se actualizan salvo que el
              periodo esté bloqueado.
            </li>
          </ol>
        </SectionCard>
        <SectionCard
          title="Formato del Archivo Excel"
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => mockInfo("Plantilla", "La descarga no existe en el prototipo.")}
            >
              <Download data-icon="inline-start" />
              Plantilla
            </Button>
          }
        >
          <p className="font-mono text-xs text-muted-foreground">
            documento |{" "}
            {grading.criteria.map((criterion) => criterion.name.toLowerCase()).join(" | ")}
          </p>
        </SectionCard>
        <GradeScaleLegend />
      </div>
    </div>
  );
}

function UploadResult({
  result,
  onReset,
  search,
}: {
  result: { created: number; updated: number; errors: string[] };
  onReset: () => void;
  search: Record<string, string>;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Callout
        tone="info"
        icon={CircleCheck}
        title={`${result.created} notas creadas y ${result.updated} actualizadas`}
      >
        Las notas se guardaron en los datos en memoria.
      </Callout>
      {result.errors.length > 0 ? (
        <SectionCard
          title={`Errores (${result.errors.length})`}
          action={<Badge variant="destructive">{result.errors.length}</Badge>}
        >
          <ul className="flex flex-col gap-1 text-[13px]">
            {result.errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </SectionCard>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onReset}>
          <FileSpreadsheet data-icon="inline-start" />
          Cargar otro archivo
        </Button>
        <ScreenLinkButton screenId="GRD-02" search={search} variant="default">
          Ver planilla
        </ScreenLinkButton>
      </div>
    </div>
  );
}
