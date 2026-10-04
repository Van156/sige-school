import { Button } from "@base-template/ui/components/button";
import { Field, FieldLabel } from "@base-template/ui/components/field";
import { Input } from "@base-template/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@base-template/ui/components/native-select";
import { CalendarCheck, Check, Download, Save, X } from "lucide-react";
import { useState } from "react";

import { Callout } from "../../-components/callout";
import { ClassContext, type ClassInfo } from "../../-components/class-context";
import { FilterBar } from "../../-components/filter-bar";
import { ScreenLinkButton } from "../../-components/link-button";
import { ScopedPage } from "../../-components/scoped-page";
import { SectionCard } from "../../-components/section-card";
import { SimpleTable, type TableColumn } from "../../-components/simple-table";
import { StatGrid, StatTile } from "../../-components/stat-tile";
import { StatusToggle } from "../../-components/status-toggle";
import { matchesQuery } from "../../-lib/list";
import { useAccessibleSubjectGrades, useGrading, type Grading } from "../../-lib/use-grading";
import { useGoToScreen } from "../../-lib/use-go-to-screen";
import { useSchool, type School } from "../../-lib/use-school";
import { useIntParam, useStringParam } from "../../-lib/use-search-params";
import {
  REFERENCE_DATE,
  mockAction,
  mockError,
  mockInfo,
  saveAttendance,
  weekdayIndex,
} from "../../-mock";
import type { AttendanceStatus, Institution } from "../../-mock/types";

interface RollEntry {
  status: AttendanceStatus;
  observation: string;
}

interface RollRow {
  index: number;
  studentId: number;
  name: string;
}

/** ATT-01: pick course, subject and date (`?grade=&sg=&date=`), then mark the roll sheet. */
export function TakeAttendanceScreen() {
  const subjectGrade = useIntParam("sg");
  return (
    <ScopedPage
      screenId="ATT-01"
      title="Tomar Asistencia"
      description="Registro diario de asistencia estudiantil"
      target="Asistencia"
      banner={false}
      actions={
        subjectGrade !== undefined ? (
          <ScreenLinkButton screenId="ATT-03" search={{ sg: String(subjectGrade) }}>
            Ver Resumen
          </ScreenLinkButton>
        ) : undefined
      }
    >
      {(institution) => <TakeView institution={institution} />}
    </ScopedPage>
  );
}

function TakeView({ institution }: { institution: Institution }) {
  const school = useSchool(institution.id);
  const grading = useGrading(institution.id);
  const access = useAccessibleSubjectGrades(school);
  const goTo = useGoToScreen();
  const subjectGradeParam = useIntParam("sg");
  const gradeParam = useStringParam("grade");
  const date = useStringParam("date") ?? REFERENCE_DATE;

  const selectedClass = access.list.find((item) => item.id === subjectGradeParam);
  const gradeValue = gradeParam ?? (selectedClass ? String(selectedClass.gradeId) : "");
  const courseIds = new Set(access.list.map((item) => item.gradeId));
  const classesOfGrade = access.list.filter((item) => String(item.gradeId) === gradeValue);

  return (
    <>
      <SectionCard title="Seleccione Grado y Asignatura">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="att-grade">Grado</FieldLabel>
            <NativeSelect
              id="att-grade"
              className="w-full"
              value={gradeValue}
              onChange={(event) => goTo("ATT-01", { grade: event.target.value || undefined, date })}
            >
              <NativeSelectOption value="">-- Seleccione un grado --</NativeSelectOption>
              {school.grades
                .filter((grade) => courseIds.has(grade.id))
                .map((grade) => (
                  <NativeSelectOption key={grade.id} value={String(grade.id)}>
                    {grade.name}
                  </NativeSelectOption>
                ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="att-subject">Asignatura</FieldLabel>
            <NativeSelect
              id="att-subject"
              className="w-full"
              disabled={!gradeValue}
              value={
                selectedClass && String(selectedClass.gradeId) === gradeValue
                  ? String(selectedClass.id)
                  : ""
              }
              onChange={(event) =>
                goTo("ATT-01", { grade: gradeValue, sg: event.target.value || undefined, date })
              }
            >
              <NativeSelectOption value="">
                {gradeValue
                  ? "-- Seleccione una asignatura --"
                  : "-- Seleccione primero un grado --"}
              </NativeSelectOption>
              {classesOfGrade.map((item) => (
                <NativeSelectOption key={item.id} value={String(item.id)}>
                  {school.subjectName(item.subjectId)} -{" "}
                  {school.userName(item.teacherId) ?? "Sin docente"}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="att-date">Fecha</FieldLabel>
            <Input
              id="att-date"
              type="date"
              value={date}
              onChange={(event) =>
                goTo("ATT-01", {
                  grade: gradeValue || undefined,
                  sg: selectedClass ? String(selectedClass.id) : undefined,
                  date: event.target.value || undefined,
                })
              }
            />
          </Field>
        </div>
      </SectionCard>

      {subjectGradeParam !== undefined ? (
        <ClassContext
          school={school}
          grading={grading}
          selectScreenId="ATT-01"
          withPeriod={false}
          permissionMessage="No tienes permiso para ver esta asignatura."
        >
          {(info) => (
            <RollSheet
              key={`${info.subjectGrade.id}-${date}`}
              info={info}
              date={date}
              school={school}
              grading={grading}
            />
          )}
        </ClassContext>
      ) : null}
    </>
  );
}

function RollSheet({
  info,
  date,
  school,
  grading,
}: {
  info: ClassInfo;
  date: string;
  school: School;
  grading: Grading;
}) {
  const existing = grading.attendance.filter(
    (row) => row.subjectGradeId === info.subjectGrade.id && row.date === date,
  );
  const [entries, setEntries] = useState<Record<number, RollEntry>>(() =>
    Object.fromEntries(
      info.students.map((student) => {
        const saved = existing.find((row) => row.studentId === student.id);
        return [
          student.id,
          { status: saved?.status ?? "presente", observation: saved?.observation ?? "" },
        ];
      }),
    ),
  );
  const [onlyAbsent, setOnlyAbsent] = useState(false);
  const [query, setQuery] = useState("");

  const entryOf = (studentId: number): RollEntry =>
    entries[studentId] ?? { status: "presente", observation: "" };
  const patch = (studentId: number, change: Partial<RollEntry>) =>
    setEntries((previous) => ({ ...previous, [studentId]: { ...entryOf(studentId), ...change } }));

  const rows: RollRow[] = info.students.map((student, index) => ({
    index: index + 1,
    studentId: student.id,
    name: school.userName(student.userId) ?? `Estudiante #${student.id}`,
  }));
  const visible = rows.filter(
    (row) =>
      matchesQuery(query, row.name) && (!onlyAbsent || entryOf(row.studentId).status === "ausente"),
  );
  const count = (status: AttendanceStatus) =>
    rows.filter((row) => entryOf(row.studentId).status === status).length;
  const weekend = weekdayIndex(date) >= 5;

  const save = () => {
    if (rows.length === 0) {
      mockError("No hay estudiantes para registrar");
      return;
    }
    saveAttendance({
      subjectGradeId: info.subjectGrade.id,
      date,
      recordedBy: info.userId,
      entries: rows.map((row) => ({
        studentId: row.studentId,
        status: entryOf(row.studentId).status,
        observation: entryOf(row.studentId).observation.trim() || undefined,
      })),
    });
    mockAction("Asistencia guardada", `${rows.length} registros del ${date}.`);
  };

  const columns: TableColumn<RollRow>[] = [
    {
      key: "index",
      header: "#",
      className: "w-10 text-muted-foreground",
      cell: (row) => row.index,
    },
    {
      key: "student",
      header: "Estudiante",
      sortValue: (row) => row.name,
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: "status",
      header: "Estado",
      cell: (row) => (
        <StatusToggle
          studentName={row.name}
          value={entryOf(row.studentId).status}
          onValueChange={(status) => patch(row.studentId, { status })}
        />
      ),
    },
    {
      key: "observation",
      header: "Observación",
      cell: (row) => (
        <Input
          value={entryOf(row.studentId).observation}
          placeholder="Observación..."
          aria-label={`Observación de ${row.name}`}
          className="h-7 min-w-36 text-xs md:text-xs"
          onChange={(event) => patch(row.studentId, { observation: event.target.value })}
        />
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Acciones rápidas</span>,
      cell: (row) => (
        <div className="flex gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Marcar ausente a ${row.name}`}
            title="Marcar ausente"
            className="text-destructive hover:text-destructive"
            onClick={() => patch(row.studentId, { status: "ausente" })}
          >
            <X />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Marcar presente a ${row.name}`}
            title="Marcar presente"
            className="text-success hover:text-success"
            onClick={() => patch(row.studentId, { status: "presente" })}
          >
            <Check />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <StatGrid>
        <StatTile label="Presentes" value={count("presente")} tone="success" />
        <StatTile label="Ausentes" value={count("ausente")} tone="destructive" />
        <StatTile label="Justificados" value={count("justificado")} tone="info" />
        <StatTile label="Excusados" value={count("excusado")} tone="warning" />
      </StatGrid>

      {weekend ? (
        <Callout tone="warning" title="Fin de semana">
          Las clases se dictan de lunes a viernes; elige otra fecha para guardar la asistencia.
        </Callout>
      ) : null}
      {existing.length > 0 ? (
        <Callout tone="info" title="Registro existente">
          Se cargaron {existing.length} registros de esta fecha; al guardar se actualizan.
        </Callout>
      ) : null}

      <SectionCard
        title={`${info.subjectName} - ${info.grade.name}`}
        description="Marca el estado de cada estudiante y guarda al terminar."
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEntries((previous) =>
                  Object.fromEntries(
                    rows.map((row) => [
                      row.studentId,
                      {
                        ...(previous[row.studentId] ?? { observation: "" }),
                        status: "presente" as const,
                      },
                    ]),
                  ),
                );
                mockInfo("Hecho", "Todos marcados como presente.");
              }}
            >
              <Check data-icon="inline-start" />
              Todos Presentes
            </Button>
            <Button
              variant={onlyAbsent ? "default" : "outline"}
              size="sm"
              aria-pressed={onlyAbsent}
              onClick={() => setOnlyAbsent((value) => !value)}
            >
              {onlyAbsent ? "Mostrar Todos" : "Solo Ausentes"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => mockInfo("Exportar", "La descarga CSV no existe en el prototipo.")}
            >
              <Download data-icon="inline-start" />
              Exportar
            </Button>
          </div>
        }
      >
        <FilterBar query={query} onQueryChange={setQuery} placeholder="Buscar estudiante" />
        <SimpleTable
          columns={columns}
          rows={visible}
          getRowId={(row) => row.studentId}
          pageSize={20}
          empty={
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              {rows.length === 0
                ? "No hay estudiantes activos en este grado."
                : "Ningún estudiante coincide con el filtro."}
            </p>
          }
        />
        <div className="flex flex-wrap gap-2">
          <Button disabled={rows.length === 0 || weekend} onClick={save}>
            <Save data-icon="inline-start" />
            Guardar Asistencia ({rows.length} estudiantes)
          </Button>
          <ScreenLinkButton screenId="ATT-03" search={{ sg: String(info.subjectGrade.id) }}>
            <CalendarCheck data-icon="inline-start" />
            Ver Resumen
          </ScreenLinkButton>
        </div>
      </SectionCard>
    </>
  );
}
