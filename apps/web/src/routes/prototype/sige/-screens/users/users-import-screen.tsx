import { Badge } from "@base-template/ui/components/badge";
import { Button } from "@base-template/ui/components/button";
import { Field, FieldDescription, FieldLabel } from "@base-template/ui/components/field";
import { Input } from "@base-template/ui/components/input";
import { CircleCheck, Download, FileSpreadsheet, Upload } from "lucide-react";
import { useState } from "react";

import { Callout } from "../../-components/callout";
import { BackButton } from "../../-components/form-layout";
import { ScreenLinkButton } from "../../-components/link-button";
import { ScreenPage } from "../../-components/scoped-page";
import { SectionCard } from "../../-components/section-card";
import { SimpleTable, type TableColumn } from "../../-components/simple-table";
import { ToneBadge } from "../../-components/tone-badge";
import { useScopeInstitution } from "../../-lib/institution-scope";
import { isRole, newUserRecord } from "../../-lib/user-options";
import { REFERENCE_DATE, mockInfo, userStore, useMockCollection } from "../../-mock";
import type { Role } from "../../-mock/types";

interface SheetRow {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
}

/** Fixed content of the "uploaded" workbook: the prototype never reads the picked file. */
const SHEET: readonly SheetRow[] = [
  row("mlondono", "mlondono@colegiosanjose.edu.co", "María", "Londoño", "teacher"),
  row("cpardo", "cpardo@colegiosanjose.edu.co", "Camilo", "Pardo", "teacher"),
  row("ltorres", "ltorres@colegiosanjose.edu.co", "Lucía", "Torres", "coordinator"),
  row("jbarrios", "jbarrios@estudiantes.colegiosanjose.edu.co", "Julián", "Barrios", "student"),
  row("aramirez", "aramirez@gmail.com", "Ana", "Ramírez", "parent"),
  row("root", "root2@colegiosanjose.edu.co", "Pedro", "Suárez", "teacher"),
  row("pvega", "pvega@colegiosanjose.edu.co", "Paula", "Vega", "director"),
  row("dcastro", "dcastro-sin-correo", "Daniel", "Castro", "teacher"),
];

function row(
  username: string,
  email: string,
  firstName: string,
  lastName: string,
  role: string,
): SheetRow {
  return { username, email, password: "123456", firstName, lastName, role };
}

const SAMPLE: SheetRow = row("juanperez", "juan@inst.edu.co", "Juan", "Pérez", "teacher");

function rowError(item: SheetRow, taken: ReadonlySet<string>): string | null {
  if (taken.has(item.username)) return `El usuario "${item.username}" ya existe.`;
  if (!isRole(item.role) || item.role === "root") return `Rol inválido "${item.role}".`;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email)) return `Correo inválido "${item.email}".`;
  return null;
}

const MAX_LISTED_ERRORS = 10;

/** USR-04: bulk user import. Mock file pick, preview with per-row validation and a result summary. */
export function UsersImportScreen() {
  const userList = useMockCollection(userStore);
  const scope = useScopeInstitution();
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);

  const taken = new Set(userList.map((user) => user.username));
  const checked = SHEET.map((item) => ({ item, error: rowError(item, taken) }));

  const runImport = () => {
    const errors: string[] = [];
    let imported = 0;
    checked.forEach(({ item, error }, index) => {
      if (error) {
        errors.push(`Fila ${index + 2}: ${error}`);
        return;
      }
      userStore.add(
        newUserRecord({
          username: item.username,
          email: item.email,
          firstName: item.firstName,
          lastName: item.lastName,
          documentType: "CC",
          documentNumber: "",
          role: item.role as Role,
          institutionId: scope?.id,
          createdAt: REFERENCE_DATE,
        }),
      );
      imported += 1;
    });
    setResult({ imported, errors });
  };

  const reset = () => {
    setFileName(null);
    setResult(null);
  };

  const columns: TableColumn<(typeof checked)[number]>[] = [
    {
      key: "username",
      header: "username",
      cell: ({ item }) => <span className="font-mono text-xs">{item.username}</span>,
    },
    { key: "email", header: "email", cell: ({ item }) => item.email },
    { key: "name", header: "Nombre", cell: ({ item }) => `${item.firstName} ${item.lastName}` },
    { key: "role", header: "role", cell: ({ item }) => item.role },
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

  const validCount = checked.filter(({ error }) => !error).length;

  return (
    <ScreenPage
      screenId="USR-04"
      title="Importar Usuarios desde Excel"
      description="Carga masiva de usuarios desde archivo Excel"
      actions={<BackButton screenId="USR-01" />}
    >
      {result ? (
        <ImportResult result={result} onReset={reset} />
      ) : (
        <SectionCard title="Archivo Excel">
          <Field>
            <FieldLabel htmlFor="users-file">Archivo Excel *</FieldLabel>
            <Input
              id="users-file"
              type="file"
              accept=".xlsx,.xls"
              onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
            />
            <FieldDescription>
              Solo archivos .xlsx o .xls (máx 10MB). El prototipo no lee el contenido: muestra una
              hoja de ejemplo.
            </FieldDescription>
          </Field>
          <div>
            <Button disabled={fileName === null} onClick={runImport}>
              <Upload data-icon="inline-start" />
              Importar Usuarios
            </Button>
          </div>
        </SectionCard>
      )}

      {fileName && !result ? (
        <SectionCard
          title="Vista previa"
          description={`${fileName} · ${checked.length} filas, ${validCount} válidas`}
        >
          <SimpleTable columns={columns} rows={checked} getRowId={({ item }) => item.username} />
        </SectionCard>
      ) : null}

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
            { key: "username", header: "username", cell: (item: SheetRow) => item.username },
            { key: "email", header: "email", cell: (item: SheetRow) => item.email },
            { key: "password", header: "password", cell: (item: SheetRow) => item.password },
            { key: "first", header: "first_name", cell: (item: SheetRow) => item.firstName },
            { key: "last", header: "last_name", cell: (item: SheetRow) => item.lastName },
            { key: "role", header: "role", cell: (item: SheetRow) => item.role },
          ]}
          rows={[SAMPLE]}
          getRowId={(item) => item.username}
        />
        <p className="text-[13px] text-muted-foreground">
          Roles válidos: root, admin, coordinator, teacher, student, parent, viewer.
        </p>
      </SectionCard>
    </ScreenPage>
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
        title={`${result.imported} usuarios importados exitosamente`}
      >
        Los usuarios se agregaron a los datos en memoria.
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
          Importar otro archivo
        </Button>
        <ScreenLinkButton screenId="USR-01" variant="default">
          Ver usuarios
        </ScreenLinkButton>
      </div>
    </div>
  );
}
