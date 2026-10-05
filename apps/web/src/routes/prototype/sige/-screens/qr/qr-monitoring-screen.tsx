import { Badge } from "@base-template/ui/components/badge";
import { ScanLine, ShieldAlert } from "lucide-react";

import { EntityList } from "../../-components/entity-list";
import { ScreenLinkButton } from "../../-components/link-button";
import { ScreenPage } from "../../-components/scoped-page";
import type { TableColumn } from "../../-components/simple-table";
import { RoleBadge, ToneBadge } from "../../-components/tone-badge";
import { QR_MONITOR_LABEL, QR_STATUS_TONE } from "../../-lib/qr";
import { useRole } from "../../-lib/use-role";
import {
  classroomStore,
  fullName,
  qrAccessLogStore,
  useMockCollection,
  userStore,
} from "../../-mock";
import type { QRAccessLog } from "../../-mock/types";

/** QR-03: latest 50 access attempts with user, room, outcome and origin. */
export function QrMonitoringScreen() {
  const role = useRole();
  const users = useMockCollection(userStore);
  const classrooms = useMockCollection(classroomStore);
  const logs = useMockCollection(qrAccessLogStore)
    .toSorted((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 50);

  const userOf = (log: QRAccessLog) => users.find((user) => user.id === log.userId);
  const roomOf = (log: QRAccessLog) =>
    classrooms.find((room) => room.id === log.classroomId)?.name ?? "Desconocida";

  const columns: TableColumn<QRAccessLog>[] = [
    {
      key: "time",
      header: "Timestamp",
      sortValue: (row) => row.timestamp,
      cell: (row) => <span className="tabular-nums">{row.timestamp.replace("T", " ")}:00</span>,
    },
    {
      key: "user",
      header: "Usuario",
      sortValue: (row) => {
        const user = userOf(row);
        return user ? fullName(user) : "Anónimo";
      },
      cell: (row) => {
        const user = userOf(row);
        return user ? fullName(user) : <span className="text-muted-foreground">Anónimo</span>;
      },
    },
    {
      key: "role",
      header: "Rol",
      cell: (row) => {
        const user = userOf(row);
        return user ? (
          <RoleBadge role={user.role} />
        ) : (
          <span className="text-muted-foreground">N/A</span>
        );
      },
    },
    { key: "place", header: "Ubicación", sortValue: roomOf, cell: roomOf },
    {
      key: "status",
      header: "Estado",
      sortValue: (row) => row.status,
      cell: (row) => (
        <ToneBadge tone={QR_STATUS_TONE[row.status]}>{QR_MONITOR_LABEL[row.status]}</ToneBadge>
      ),
    },
    { key: "message", header: "Mensaje", cell: (row) => row.message ?? "-" },
    {
      key: "origin",
      header: "Origen",
      cell: (row) => <span className="font-mono text-xs">{row.ipAddress ?? "---"}</span>,
    },
  ];

  return (
    <ScreenPage
      screenId="QR-03"
      title="Monitoreo de Accesos QR"
      description="Últimos 50 intentos de acceso registrados"
      actions={
        role === "root" ? (
          <ScreenLinkButton screenId="QR-02">
            <ScanLine data-icon="inline-start" />
            Ir al Simulador
          </ScreenLinkButton>
        ) : undefined
      }
    >
      <EntityList
        title="Registro de Accesos QR"
        action={<Badge variant="secondary">{logs.length} registros</Badge>}
        columns={columns}
        rows={logs}
        getRowId={(row) => row.id}
        searchText={(row) => {
          const user = userOf(row);
          return [user ? fullName(user) : "Anónimo", roomOf(row), row.message, row.ipAddress];
        }}
        searchPlaceholder="Buscar por usuario, salón o mensaje"
        emptyIcon={<ShieldAlert />}
        emptyTitle="Sin registros"
        emptyDescription="Aún no hay intentos de acceso registrados."
        pageSize={15}
      />
    </ScreenPage>
  );
}
