import { Badge } from "@base-template/ui/components/badge";
import { Button } from "@base-template/ui/components/button";
import { Field, FieldDescription, FieldLabel } from "@base-template/ui/components/field";
import { Input } from "@base-template/ui/components/input";
import { CircleCheck, Download, FileSpreadsheet, Upload } from "lucide-react";
import { useState } from "react";

import { Callout } from "../../-components/callout";
import { BackButton } from "../../-components/form-layout";
import { ScreenLinkButton } from "../../-components/link-button";
import { ScopedPage } from "../../-components/scoped-page";
import { SectionCard } from "../../-components/section-card";
import { SimpleTable, type TableColumn } from "../../-components/simple-table";
import { ToneBadge } from "../../-components/tone-badge";
import { useSchool, type School } from "../../-lib/use-school";
import { generateUsername } from "../../-lib/usernames";
import { isDocType, newUserRecord } from "../../-lib/user-options";
import { REFERENCE_DATE, enrollStudents, mockInfo, studentStore, userStore } from "../../-mock";
import type { Institution } from "../../-mock/types";

interface SheetRow {
  firstName: string;
  lastName: string;
  document: string;
  docType: string;
  grade: string;
  campus: string;
  guardian: string;
  guardianPhone: string;
  guardianEmail: string;
}

function sheetRow(
  firstName: string,
  lastName: string,
  document: string,
  grade: string,
  guardian: string,
  extra: Partial<SheetRow> = {},
): SheetRow {
  return {
    firstName,
    lastName,
    document,
    docType: "TI",
    grade,
    campus: "",
    guardian,
    guardianPhone: "3105550142",
    guardianEmail: "acudiente@correo.com",
    ...extra,
  };
}

/** Fixed content of the "uploaded" workbook; one row reuses the document of an existing student. */
function buildSheet(existingDocument: string): SheetRow[] {
  return [
    sheetRow("Ana María", "Cifuentes Duque", "1101234501", "6-01", "Luz Dary Duque"),
    sheetRow("Felipe", "Arango Villa", "1101234502", "6-02", "Carlos Arango"),
    sheetRow("Luciana", "Prada Ospina", "1101234503", "7-01", "Marta Ospina"),
    sheetRow("Esteban", "Mejía Toro", "1101234504", "5-01", "Jorge Mejía"),
    sheetRow("Mariana", "Duplicada Prueba", existingDocument, "6-01", "Acudiente Prueba"),
    sheetRow("Camilo", "Sin Documento", "", "6-01", "Acudiente Prueba"),
    sheetRow("Sara", "Grado Inexistente", "1101234507", "13-01", "Acudiente Prueba"),
  ];
}

const REQUIRED_COLUMNS: ReadonlyArray<readonly [string, boolean]> = [
  ["nombre", true],
  ["apellido", true],
  ["documento", true],
  ["tipo_documento", false],
  ["fecha_nacimiento", false],
  ["genero", false],
  ["grado", false],
  ["sede", false],
  ["acudiente", false],
  ["telefono_acudiente", false],
  ["email_acudiente", false],
  ["direccion", false],
  ["barrio", false],
  ["estrato", false],
  ["tipo_sangre", false],
  ["eps", false],
];

const MAX_LISTED_ERRORS = 10;

/** STU-05: bulk student import. Mock file pick, preview with per-row validation and a summary. */
export function StudentsImportScreen() {
  return (
    <ScopedPage
      screenId="STU-05"
      title="Cargar Estudiantes desde Excel"
      description="Carga masiva de estudiantes desde archivo Excel"
      target="Estudiantes"
      banner={false}
      back={<BackButton screenId="STU-01" />}
    >
      {(institution) => <ImportView institution={institution} />}
    </ScopedPage>
  );
}

function rowError(
  row: SheetRow,
  school: School,
  takenDocuments: ReadonlySet<string>,
): string | null {
  if (!row.document.trim()) return "Falta el documento.";
  if (takenDocuments.has(row.document)) return "Ya existe un estudiante con este documento.";
  if (!isDocType(row.docType)) return `Tipo de documento inválido "${row.docType}".`;
  if (row.grade && !school.grades.some((grade) => grade.name === row.grade)) {
    return `El grado "${row.grade}" no existe.`;
  }
  return null;
}

function ImportView({ institution }: { institution: Institution }) {
  const school = useSchool(institution.id);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);

  const takenDocuments = new Set(school.users.map((user) => user.documentNumber));
  const existingStudent = school.users.find((user) => user.role === "student");
  const sheet = buildSheet(existingStudent?.documentNumber ?? "0000000000");
  const checked = sheet.map((row) => ({ row, error: rowError(row, school, takenDocuments) }));
  const validCount = checked.filter(({ error }) => !error).length;

  const runImport = () => {
    const errors: string[] = [];
    let imported = 0;
    const usernames = new Set(school.users.map((user) => user.username));
    checked.forEach(({ row, error }, index) => {
      if (error) {
        errors.push(`Fila ${index + 2}: ${error}`);
        return;
      }
      const grade = school.grades.find((entry) => entry.name === row.grade);
      const campusId =
        grade?.campusId ??
        school.campuses.find((c) => c.isMainCampus)?.id ??
        school.campuses[0]?.id;
      if (campusId === undefined || !isDocType(row.docType)) return;
      const username = generateUsername(row.firstName, row.lastName, row.document, usernames);
      usernames.add(username);
      const user = userStore.add(
        newUserRecord({
          username,
          email: `${username}@estudiantes.colegiosanjose.edu.co`,
          firstName: row.firstName,
          lastName: row.lastName,
          documentType: row.docType,
          documentNumber: row.document,
          role: "student",
          institutionId: institution.id,
          createdAt: REFERENCE_DATE,
        }),
      );
      const student = studentStore.add({
        userId: user.id,
        institutionId: institution.id,
        campusId,
        gradeId: grade?.id,
        guardianName: row.guardian,
        guardianPhone: row.guardianPhone,
        guardianEmail: row.guardianEmail,
        enrolledYear: institution.academicYear,
        status: "activo",
      });
      if (grade) enrollStudents(grade.id, [student.id], institution.academicYear);
      imported += 1;
    });
    setResult({ imported, errors });
  };

  const reset = () => {
    setFileName(null);
    setResult(null);
  };

  const columns: TableColumn<(typeof checked)[number]>[] = [
    { key: "first", header: "nombre", cell: ({ row }) => row.firstName },
    { key: "last", header: "apellido", cell: ({ row }) => row.lastName },
    {
      key: "document",
      header: "documento",
      cell: ({ row }) => <span className="font-mono text-xs">{row.document || "-"}</span>,
    },
    { key: "grade", header: "grado", cell: ({ row }) => row.grade },
    { key: "guardian", header: "acudiente", cell: ({ row }) => row.guardian },
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
          <ImportResult result={result} onReset={reset} />
        ) : (
          <SectionCard title="Subir Archivo">
            <Field>
              <FieldLabel htmlFor="students-file">Archivo Excel (.xlsx, .xls) *</FieldLabel>
              <Input
                id="students-file"
                type="file"
                accept=".xlsx,.xls"
                onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
              />
              <FieldDescription>
                Tamaño máximo: 10MB. El prototipo no lee el contenido: muestra una hoja de ejemplo.
              </FieldDescription>
            </Field>
            <Callout tone="info" title="Importante">
              Los estudiantes que ya existen (mismo documento) serán omitidos. La contraseña inicial
              es el número de documento y el usuario se genera automáticamente.
            </Callout>
            <div className="flex flex-wrap gap-2">
              <Button disabled={fileName === null} onClick={runImport}>
                <Upload data-icon="inline-start" />
                Cargar Estudiantes
              </Button>
              <ScreenLinkButton screenId="STU-01">Cancelar</ScreenLinkButton>
            </div>
          </SectionCard>
        )}

        {fileName && !result ? (
          <SectionCard
            title="Vista previa"
            description={`${fileName} · ${checked.length} filas, ${validCount} válidas`}
          >
            <SimpleTable columns={columns} rows={checked} getRowId={({ row }) => row.firstName} />
          </SectionCard>
        ) : null}
      </div>

      <SectionCard
        title="Formato Requerido"
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
        <SimpleTable
          columns={[
            {
              key: "column",
              header: "Columna",
              cell: ([name]: (typeof REQUIRED_COLUMNS)[number]) => (
                <span className="font-mono text-xs">{name}</span>
              ),
            },
            {
              key: "required",
              header: "Obligatorio",
              cell: ([, required]: (typeof REQUIRED_COLUMNS)[number]) =>
                required ? (
                  <Badge variant="destructive">Sí</Badge>
                ) : (
                  <Badge variant="secondary">No</Badge>
                ),
            },
          ]}
          rows={REQUIRED_COLUMNS}
          getRowId={([name]) => name}
        />
      </SectionCard>
    </div>
  );
}

function ImportResult({
  result,
  onReset,
}: {
  result: { imported: number; errors: string[] };
  onReset: () => void;
}) {
  const listed = result.errors.slice(0, MAX_LISTED_ERRORS);
  const hidden = result.errors.length - listed.length;
  return (
    <div className="flex flex-col gap-4">
      <Callout
        tone="info"
        icon={CircleCheck}
        title={`${result.imported} estudiantes importados exitosamente`}
      >
        Los estudiantes se agregaron a los datos en memoria.
      </Callout>
      {result.errors.length > 0 ? (
        <SectionCard
          title={`Errores (${result.errors.length})`}
          action={<Badge variant="destructive">{result.errors.length}</Badge>}
        >
          <ul className="flex flex-col gap-1 text-[13px]">
            {listed.map((message) => (
              <li key={message}>{message}</li>
            ))}
            {hidden > 0 ? (
              <li className="text-muted-foreground">... y {hidden} errores más</li>
            ) : null}
          </ul>
        </SectionCard>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onReset}>
          <FileSpreadsheet data-icon="inline-start" />
          Cargar otro archivo
        </Button>
        <ScreenLinkButton screenId="STU-01" variant="default">
          Ver estudiantes
        </ScreenLinkButton>
      </div>
    </div>
  );
}
