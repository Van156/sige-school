import { ScanLine } from "lucide-react";
import { useState } from "react";

import { Callout } from "../../-components/callout";
import { SelectField, TextField } from "../../-components/form-fields";
import { BackButton, FormCard, FormLayout, HelpCard } from "../../-components/form-layout";
import { ScreenPage } from "../../-components/scoped-page";
import { ROLE_LABEL, ROLES, parseRole } from "../../-lib/roles";
import { useSimpleForm, type FormErrors } from "../../-lib/use-form";
import {
  classroomStore,
  demoUserByRole,
  qrTokenStore,
  simulateQrScan,
  useMockCollection,
  type QrScanResult,
} from "../../-mock";

interface Values {
  classroomId: string;
  token: string;
  time: string;
  demoRole: string;
}

/** QR-02: root-only hardware simulator; posts a token for a room and logs the outcome. */
export function QrSimulatorScreen() {
  const classrooms = useMockCollection(classroomStore);
  const tokens = useMockCollection(qrTokenStore);
  const [result, setResult] = useState<QrScanResult | null>(null);

  const form = useSimpleForm<Values>(
    { classroomId: "", token: "", time: "08:00", demoRole: "" },
    (values) => {
      const errors: FormErrors<Values> = {};
      if (!values.classroomId) errors.classroomId = "Selecciona la ubicación del lector.";
      if (!values.token.trim()) errors.token = "El token es obligatorio.";
      if (!/^\d{2}:\d{2}$/.test(values.time)) errors.time = "Indica la hora simulada.";
      return errors;
    },
  );

  const fillFromRole = (role: string) => {
    form.set("demoRole", role);
    if (!role) return;
    const token = tokens.find((row) => row.userId === demoUserByRole[parseRole(role)]);
    if (token) form.set("token", token.token);
  };

  const submit = form.handleSubmit((values) => {
    setResult(
      simulateQrScan({
        classroomId: Number(values.classroomId),
        token: values.token,
        time: values.time,
      }),
    );
  });

  return (
    <ScreenPage
      screenId="QR-02"
      title="Simulador de Hardware QR"
      description="Herramienta de desarrollo - Solo ROOT"
      back={<BackButton screenId="QR-03" label="Volver al monitoreo" />}
    >
      <FormLayout
        form={
          <FormCard
            title="Simular escaneo"
            onSubmit={submit}
            submitLabel="Simular Pulso de Escaneo"
          >
            <SelectField
              label="1. Seleccionar Ubicación (Lector)"
              required
              placeholder="Seleccione un salón/laboratorio..."
              options={classrooms.map((room) => ({
                value: String(room.id),
                label: `${room.name} (${room.code ?? "Sin código"})`,
              }))}
              {...form.bind("classroomId")}
            />
            <SelectField
              label="Rellenar con el token de"
              placeholder="Elegir un usuario de ejemplo..."
              hint="Atajo del prototipo: copia el token del usuario de cada rol."
              options={ROLES.map((role) => ({ value: role, label: ROLE_LABEL[role] }))}
              id="demoRole"
              value={form.values.demoRole}
              onValueChange={fillFromRole}
            />
            <TextField
              label="2. Token del Usuario (Simular Escaneo)"
              required
              placeholder="Pegue el UUID del token aquí..."
              hint='Puede encontrar su propio token en la sección "Mi QR".'
              {...form.bind("token")}
            />
            <TextField
              label="3. Hora simulada (lunes)"
              type="time"
              hint="El lector valida contra el horario semanal en esta hora."
              {...form.bind("time")}
            />
          </FormCard>
        }
        help={
          <>
            {result ? (
              <Callout
                tone={result.status === "authorized" ? "info" : "destructive"}
                icon={ScanLine}
                title={`${result.status === "authorized" ? "ÉXITO" : "DENEGADO"}: ${result.message}`}
              >
                {result.userName ? `Usuario: ${result.userName}` : "Usuario no identificado"}
              </Callout>
            ) : null}
            <HelpCard title="¿Cómo funciona?">
              <ol className="ml-4 flex list-decimal flex-col gap-1">
                <li>Emite una señal idéntica a la de un lector físico.</li>
                <li>El sistema valida el token contra el horario de clases.</li>
                <li>Se genera un registro en los logs de acceso (QR-03).</li>
              </ol>
            </HelpCard>
          </>
        }
      />
    </ScreenPage>
  );
}
