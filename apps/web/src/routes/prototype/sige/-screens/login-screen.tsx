import { Button } from "@base-template/ui/components/button";
import { Checkbox } from "@base-template/ui/components/checkbox";
import { Field, FieldGroup, FieldLabel } from "@base-template/ui/components/field";
import { Input } from "@base-template/ui/components/input";
import { useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import { AuthHeading, SigeAuthLayout } from "../-components/auth-layout";
import { Callout } from "../-components/callout";
import { PasswordInput } from "../-components/password-input";
import { SigeLinkButton } from "../-components/link-button";
import { ROLES, ROLE_LABEL } from "../-lib/roles";
import {
  currentUserFor,
  firstLoginDemoUser,
  fullName,
  mockAction,
  mockInfo,
  users,
} from "../-mock";
import type { Role } from "../-mock/types";

type LoginError = { tone: "warning" | "destructive"; message: string } | null;

/** AUTH-01. Any non-empty password works; the username decides the role (or the demo errors). */
export function LoginScreen() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<LoginError>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const login = identifier.trim().toLowerCase();

    if (!login || !password) {
      setError({ tone: "warning", message: "Por favor ingrese usuario y contraseña." });
      return;
    }
    if (login === "inactivo") {
      setError({
        tone: "destructive",
        message: "Su cuenta está desactivada. Contacte al administrador.",
      });
      return;
    }
    if (login === firstLoginDemoUser.username) {
      mockInfo("⚠️ Debe cambiar su contraseña antes de continuar.");
      void navigate({ to: "/prototype/sige/auth/cambiar-contrasena", search: { role: "student" } });
      return;
    }

    const user = users.find((entry) => entry.username === login || entry.email === login);
    if (!user) {
      setError({ tone: "destructive", message: "Usuario o contraseña incorrectos." });
      return;
    }
    setError(null);
    mockAction(`Bienvenido/a, ${user.firstName}!`);
    void navigate({ to: "/prototype/sige/dashboard", search: { role: user.role } });
  };

  return (
    <SigeAuthLayout>
      <div className="flex flex-col gap-8">
        <AuthHeading title="SIGE" description="Sistema Integral de Gestión Escolar" />
        <form className="flex flex-col gap-6" onSubmit={submit} noValidate>
          {error ? <Callout tone={error.tone}>{error.message}</Callout> : null}
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="identifier">Usuario o Correo</FieldLabel>
              <Input
                id="identifier"
                size="lg"
                autoFocus
                autoComplete="username"
                placeholder="Ingrese su usuario"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Contraseña</FieldLabel>
              <PasswordInput
                id="password"
                large
                autoComplete="current-password"
                placeholder="Ingrese su contraseña"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
            <Field orientation="horizontal">
              <Checkbox
                id="remember"
                checked={remember}
                onCheckedChange={(checked) => setRemember(checked === true)}
              />
              <FieldLabel htmlFor="remember" className="font-normal">
                Recordarme
              </FieldLabel>
            </Field>
          </FieldGroup>
          <Button type="submit" size="lg" className="w-full">
            Iniciar Sesión
          </Button>
          <p className="text-center text-[13px] text-muted-foreground">
            ¿Problemas para acceder? Contacte al administrador
          </p>
        </form>

        <section
          className="flex flex-col gap-2 border-t pt-5"
          aria-label="Accesos rápidos del prototipo"
        >
          <h2 className="text-sm font-medium">Accesos rápidos (prototipo)</h2>
          <p className="text-[13px] text-muted-foreground">
            Entra directamente como cada rol. También funcionan{" "}
            <code className="font-mono text-xs">jlopez0001</code> (primer acceso) e{" "}
            <code className="font-mono text-xs">inactivo</code> (cuenta desactivada).
          </p>
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map((role: Role) => (
              <SigeLinkButton
                key={role}
                to="/prototype/sige/dashboard"
                asRole={role}
                className="h-auto justify-start py-1.5"
              >
                <span className="flex min-w-0 flex-col items-start text-left">
                  <span>{ROLE_LABEL[role]}</span>
                  <span className="max-w-full truncate text-xs font-normal text-muted-foreground">
                    {fullName(currentUserFor(role))}
                  </span>
                </span>
              </SigeLinkButton>
            ))}
          </div>
        </section>
      </div>
    </SigeAuthLayout>
  );
}
