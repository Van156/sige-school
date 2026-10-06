import { Button } from "@base-template/ui/components/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@base-template/ui/components/field";
import { useNavigate } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import { useState, type FormEvent } from "react";

import { AuthHeading, SigeAuthLayout } from "../-components/auth-layout";
import { PasswordInput } from "../-components/password-input";
import { StrengthMeter } from "../-components/strength-meter";
import { firstLoginDemoUser, fullName, mockAction } from "../-mock";

/** AUTH-03: forced password change on first login. The demo "current password" is the document number. */
export function ForcePasswordScreen() {
  const navigate = useNavigate();
  const user = firstLoginDemoUser;
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const matches = confirm.length > 0 && next === confirm;
  const canSubmit = current.length > 0 && next.length >= 6 && matches;
  const requiredError = (value: string) =>
    submitted && value.length === 0 ? "Este campo es obligatorio" : null;
  const currentError = requiredError(current);
  const nextError = requiredError(next);
  const confirmError = requiredError(confirm);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (!current || !next || !confirm) return;
    if (!canSubmit) return;
    if (current !== user.documentNumber) {
      setServerError("La contraseña actual es incorrecta.");
      return;
    }
    if (next === current) {
      setServerError("La nueva contraseña debe ser diferente a la actual.");
      return;
    }
    mockAction("✅ Contraseña actualizada exitosamente. Ahora puede acceder al sistema.");
    void navigate({ to: "/prototype/sige/dashboard", search: { role: "student" } });
  };

  return (
    <SigeAuthLayout>
      <form className="flex flex-col gap-6" onSubmit={submit} noValidate>
        <AuthHeading
          icon={<TriangleAlert />}
          title="Cambiar Contraseña"
          description="Es obligatorio cambiar su contraseña antes de continuar"
        />
        <div className="flex flex-col rounded-lg border bg-card px-3 py-2">
          <span className="text-sm font-medium">{fullName(user)}</span>
          <span className="text-[13px] text-muted-foreground">{user.username}</span>
        </div>
        <FieldGroup>
          <Field data-invalid={Boolean(currentError || serverError)}>
            <FieldLabel htmlFor="current">Contraseña Actual</FieldLabel>
            <PasswordInput
              id="current"
              large
              autoFocus
              autoComplete="current-password"
              aria-invalid={Boolean(currentError || serverError)}
              value={current}
              onChange={(event) => {
                setCurrent(event.target.value);
                setServerError(null);
              }}
            />
            <FieldDescription>Es su número de documento: {user.documentNumber}</FieldDescription>
            {currentError || serverError ? (
              <FieldError>{currentError ?? serverError}</FieldError>
            ) : null}
          </Field>
          <Field data-invalid={Boolean(nextError)}>
            <FieldLabel htmlFor="next">Nueva Contraseña</FieldLabel>
            <PasswordInput
              id="next"
              large
              autoComplete="new-password"
              placeholder="Mínimo 6 caracteres"
              aria-invalid={Boolean(nextError)}
              value={next}
              onChange={(event) => setNext(event.target.value)}
            />
            {nextError ? <FieldError>{nextError}</FieldError> : null}
            <StrengthMeter password={next} />
          </Field>
          <Field data-invalid={Boolean(confirmError)}>
            <FieldLabel htmlFor="confirm">Confirmar Nueva Contraseña</FieldLabel>
            <PasswordInput
              id="confirm"
              large
              autoComplete="new-password"
              aria-invalid={Boolean(confirmError)}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
            {confirmError ? <FieldError>{confirmError}</FieldError> : null}
            {confirm.length > 0 ? (
              <span
                aria-live="polite"
                className={matches ? "text-xs text-success" : "text-xs text-destructive"}
              >
                {matches ? "Las contraseñas coinciden" : "Las contraseñas no coinciden"}
              </span>
            ) : null}
          </Field>
        </FieldGroup>
        <Button type="submit" size="lg" className="w-full">
          Actualizar Contraseña
        </Button>
        <p className="text-center text-[13px] text-muted-foreground">
          Esta contraseña será su acceso permanente al sistema
        </p>
      </form>
    </SigeAuthLayout>
  );
}
