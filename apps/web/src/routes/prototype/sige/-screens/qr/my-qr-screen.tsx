import { Badge } from "@base-template/ui/components/badge";
import { Button } from "@base-template/ui/components/button";
import { Download, QrCode as QrIcon, RefreshCw, ShieldCheck } from "lucide-react";

import { ConfirmActionButton } from "../../-components/confirm-action";
import { EmptyBlock } from "../../-components/empty-block";
import { QrCode } from "../../-components/qr-code";
import { ScreenPage } from "../../-components/scoped-page";
import { SectionCard } from "../../-components/section-card";
import { SimpleTable, type TableColumn } from "../../-components/simple-table";
import { ToneBadge } from "../../-components/tone-badge";
import { formatDateTime } from "../../-lib/format";
import { QR_STATUS_LABEL, QR_STATUS_TONE } from "../../-lib/qr";
import { ROLE_LABEL } from "../../-lib/roles";
import { useRole } from "../../-lib/use-role";
import {
  classroomStore,
  currentUserFor,
  fullName,
  mockAction,
  mockInfo,
  qrAccessLogStore,
  qrTokenStore,
  regenerateQrToken,
  useMockCollection,
} from "../../-mock";
import type { QRAccessLog } from "../../-mock/types";

/** QR-01: personal digital ID (any role) with regenerate action and the last ten scans. */
export function MyQrScreen() {
  const role = useRole();
  const user = currentUserFor(role);
  const token = useMockCollection(qrTokenStore).find((row) => row.userId === user.id);
  const logs = useMockCollection(qrAccessLogStore)
    .filter((log) => log.userId === user.id)
    .toSorted((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 10);
  const classrooms = useMockCollection(classroomStore);

  const columns: TableColumn<QRAccessLog>[] = [
    {
      key: "time",
      header: "Fecha y Hora",
      cell: (row) => <span className="tabular-nums">{formatDateTime(row.timestamp)}</span>,
    },
    {
      key: "place",
      header: "Ubicación",
      cell: (row) => classrooms.find((room) => room.id === row.classroomId)?.name ?? "Desconocida",
    },
    {
      key: "status",
      header: "Estado",
      cell: (row) => (
        <ToneBadge tone={QR_STATUS_TONE[row.status]}>{QR_STATUS_LABEL[row.status]}</ToneBadge>
      ),
    },
  ];

  return (
    <ScreenPage screenId="QR-01" title="Mi Código QR" description="Identidad Digital">
      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Identidad Digital">
          <div className="flex flex-col items-center gap-3 text-center">
            {token ? (
              <>
                <QrCode
                  value={token.token}
                  label={`Código QR de ${fullName(user)}`}
                  className="size-56 sm:size-64"
                />
                <Badge variant="success">
                  <ShieldCheck />
                  Token Activo y Seguro
                </Badge>
              </>
            ) : (
              <EmptyBlock
                icon={<QrIcon />}
                title="Aún no tienes un código"
                description="Genera tu código para presentarlo en los lectores."
              />
            )}
            <div className="flex flex-col">
              <span className="font-medium">{fullName(user)}</span>
              <span className="text-[13px] text-muted-foreground">{ROLE_LABEL[role]}</span>
            </div>
            {token ? (
              <p className="max-w-full break-all font-mono text-xs text-muted-foreground">
                {token.token}
              </p>
            ) : null}
            <div className="flex flex-wrap justify-center gap-2">
              {token ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() =>
                      mockInfo("Descargar Carnet", "La descarga no existe en el prototipo.")
                    }
                  >
                    <Download data-icon="inline-start" />
                    Descargar Carnet
                  </Button>
                  <ConfirmActionButton
                    destructive
                    title="¿Seguro que desea regenerar su QR?"
                    description="El código anterior dejará de funcionar instantáneamente."
                    confirmLabel="Regenerar"
                    onConfirm={() => {
                      regenerateQrToken(user.id);
                      mockAction("Su código QR ha sido regenerado exitosamente.");
                    }}
                  >
                    <RefreshCw data-icon="inline-start" />
                    Regenerar Código
                  </ConfirmActionButton>
                </>
              ) : (
                <Button
                  onClick={() => {
                    regenerateQrToken(user.id);
                    mockAction("Código QR generado");
                  }}
                >
                  Generar Código
                </Button>
              )}
            </div>
          </div>
        </SectionCard>

        <div className="flex flex-col gap-4 lg:col-span-2">
          <SectionCard title="Actividad Reciente">
            <SimpleTable
              columns={columns}
              rows={logs}
              getRowId={(row) => row.id}
              empty={
                <EmptyBlock
                  icon={<QrIcon />}
                  title="Aún no se registran escaneos con su código QR."
                />
              }
            />
          </SectionCard>
          <SectionCard title="Instrucciones de Uso">
            <ul className="ml-4 flex list-disc flex-col gap-1 text-[13px] text-muted-foreground">
              <li>
                Presente este código en el lector ubicado a la entrada de cada salón o laboratorio.
              </li>
              <li>El acceso solo se habilitará durante su horario de clase programado.</li>
              <li>No comparta su código QR; cada acceso queda registrado a su nombre.</li>
            </ul>
          </SectionCard>
        </div>
      </div>
    </ScreenPage>
  );
}
