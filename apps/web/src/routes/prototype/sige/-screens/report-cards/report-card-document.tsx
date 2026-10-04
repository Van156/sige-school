import type { ReactNode } from "react";

import { formatDate, formatDateTime, formatScore } from "../../-lib/format";
import { tally } from "../../-lib/class-stats";
import type { Grading } from "../../-lib/use-grading";
import type { School } from "../../-lib/use-school";
import { performanceLevel, statusFromScore } from "../../-mock";
import type {
  AcademicPeriod,
  AcademicStudent,
  Institution,
  PerformanceLevel,
  ReportCard,
} from "../../-mock/types";

const SCALE: ReadonlyArray<readonly [PerformanceLevel, string, string]> = [
  ["Superior", "4.6 - 5.0", "Mínimo: 4.6"],
  ["Alto", "4.0 - 4.5", "Mínimo: 4.0"],
  ["Básico", "3.0 - 3.9", "Mínimo: 3.0"],
  ["Bajo", "1.0 - 2.9", "Máximo: 2.9"],
];

const SIGNATURES = ["Director(a) de Grupo", "Coordinador(a) Académico(a)", "Rector(a)"] as const;

/**
 * Print layout of a report card (legacy `pdf_template.html`): an A4 sheet that stays white and
 * dark-on-light in both themes so the printout looks the same as the preview.
 */
export function ReportCardDocument({
  card,
  student,
  period,
  institution,
  school,
  grading,
}: {
  card: ReportCard;
  student: AcademicStudent;
  period: AcademicPeriod;
  institution: Institution;
  school: School;
  grading: Grading;
}) {
  const user = school.userOfStudent(student);
  const grade = student.gradeId === undefined ? undefined : school.gradeById.get(student.gradeId);
  const classes = school.subjectGrades.filter((item) => item.gradeId === student.gradeId);
  const lines = classes.map((item) => ({
    item,
    subject: school.subjectName(item.subjectId),
    teacher: school.userName(item.teacherId),
    final: grading.finalOf(student.id, item.id, period.id),
  }));
  const comments = grading.cardObservations.filter((comment) => comment.reportCardId === card.id);
  const attendance = tally(
    grading.attendance.filter(
      (row) =>
        row.studentId === student.id && row.date >= period.startDate && row.date <= period.endDate,
    ),
  );
  const location = [institution.municipality, institution.department].filter(Boolean).join(", ");

  return (
    <article
      aria-label={`Boletín de ${school.userName(student.userId) ?? "estudiante"} ${period.shortName}`}
      className="mx-auto flex w-full max-w-[794px] flex-col gap-5 rounded-lg border border-neutral-300 bg-white p-6 text-[13px] text-neutral-900 shadow-sm sm:p-10 print:max-w-none print:border-0 print:p-0 print:shadow-none"
    >
      <header className="flex items-center justify-between gap-4 border-b-2 border-neutral-900 pb-4">
        <div
          aria-hidden="true"
          className="flex size-14 shrink-0 items-center justify-center rounded border border-dashed border-neutral-400 text-[10px] text-neutral-500"
        >
          LOGO
        </div>
        <div className="flex min-w-0 flex-col items-center text-center">
          <h2 className="text-lg font-bold uppercase">{institution.name}</h2>
          {institution.nit ? <span>NIT: {institution.nit}</span> : null}
          {institution.resolution ? <span>Resolución: {institution.resolution}</span> : null}
          {location ? <span>{location}</span> : null}
        </div>
        <div
          aria-hidden="true"
          className="flex size-14 shrink-0 items-center justify-center rounded border border-dashed border-neutral-400 text-[10px] text-neutral-500"
        >
          ESCUDO
        </div>
      </header>

      <div className="rounded bg-neutral-900 px-3 py-1.5 text-center text-sm font-semibold text-white">
        Boletín de Calificaciones - {period.shortName} {period.academicYear}
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="font-semibold">Datos del Estudiante</h3>
        <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          <Datum label="Nombre completo" value={school.userName(student.userId)} />
          <Datum
            label="Documento"
            value={user ? `${user.documentType} ${user.documentNumber}` : undefined}
          />
          <Datum label="Grado" value={grade?.name} />
          <Datum label="Sede" value={school.campusName(student.campusId)} />
          {grade?.directorId ? (
            <Datum label="Director de Grupo" value={school.userName(grade.directorId)} />
          ) : null}
          <Datum label="Fecha de generación" value={formatDate(card.generatedAt)} />
        </dl>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-semibold">Calificaciones por Asignatura</h3>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-neutral-100">
              <Th>Asignatura</Th>
              <Th align="center">Nota Final</Th>
              <Th align="center">Desempeño</Th>
              <Th align="center">Estado</Th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.item.id}>
                <Td>{line.subject}</Td>
                <Td align="center">{line.final === null ? "N/A" : formatScore(line.final, 1)}</Td>
                <Td align="center">{line.final === null ? "-" : performanceLevel(line.final)}</Td>
                <Td align="center">
                  <strong
                    className={
                      statusFromScore(line.final) === "perdida"
                        ? "text-red-700"
                        : statusFromScore(line.final) === "ganada"
                          ? "text-green-700"
                          : "text-neutral-500"
                    }
                  >
                    {statusFromScore(line.final) === "ganada"
                      ? "APROBADO"
                      : statusFromScore(line.final) === "perdida"
                        ? "REPROBADO"
                        : "N/E"}
                  </strong>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-semibold">Escala Valorativa Institucional</h3>
        <table className="w-full border-collapse text-center">
          <tbody>
            <tr>
              {SCALE.map(([level, range, bound]) => (
                <td key={level} className="border border-neutral-300 px-2 py-1.5">
                  <strong>
                    {level} ({range})
                  </strong>
                  <br />
                  <span className="text-xs text-neutral-600">{bound}</span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </section>

      {comments.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h3 className="font-semibold">Observaciones por Asignatura</h3>
          <ul className="flex flex-col gap-2">
            {comments.map((comment) => {
              const item = school.subjectGradeById.get(comment.subjectGradeId);
              return (
                <li key={comment.id}>
                  <strong>
                    {item ? school.subjectName(item.subjectId) : "Asignatura"} -{" "}
                    {item ? (school.userName(item.teacherId) ?? "Sin docente") : ""}
                  </strong>
                  <p className="text-neutral-700">{comment.observation}</p>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-1">
        <h3 className="font-semibold">Observación General del Director de Grupo</h3>
        {card.generalObservation ? (
          <p>{card.generalObservation}</p>
        ) : (
          <p className="text-neutral-500 italic">Sin observaciones generales registradas.</p>
        )}
      </section>

      {attendance.total > 0 ? (
        <section className="flex flex-col gap-2">
          <h3 className="font-semibold">Resumen de Asistencia - {period.shortName}</h3>
          <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            {(
              [
                ["Presentes", attendance.present],
                ["Ausencias", attendance.absent],
                ["Justificadas", attendance.justified],
                ["Total Registros", attendance.total],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded border border-neutral-300 px-2 py-1.5">
                <div className="text-lg font-semibold tabular-nums">{value}</div>
                <div className="text-xs text-neutral-600">{label}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-6 grid grid-cols-3 gap-6 text-center">
        {SIGNATURES.map((label) => (
          <div key={label} className="flex flex-col gap-0.5 border-t border-neutral-900 pt-1">
            <span className="font-medium">{label}</span>
            <span className="text-xs text-neutral-500">Firma</span>
          </div>
        ))}
      </div>

      <footer className="border-t border-neutral-300 pt-3 text-center text-xs text-neutral-600">
        <p>{institution.name} - Sistema Integral de Gestión Escolar (SIGE)</p>
        <p>
          Documento generado el {formatDateTime(card.generatedAt)}. Este boletín es un documento
          oficial.
        </p>
      </footer>
    </article>
  );
}

function Datum({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="flex gap-1.5">
      <dt className="font-medium">{label}:</dt>
      <dd>{value ?? "N/A"}</dd>
    </div>
  );
}

function Th({ children, align }: { children: string; align?: "center" }) {
  return (
    <th
      className={`border border-neutral-300 px-2 py-1.5 font-semibold ${align === "center" ? "text-center" : ""}`}
    >
      {children}
    </th>
  );
}

function Td({ children, align }: { children: ReactNode; align?: "center" }) {
  return (
    <td
      className={`border border-neutral-300 px-2 py-1.5 ${align === "center" ? "text-center" : ""}`}
    >
      {children}
    </td>
  );
}
