import { Button } from "@base-template/ui/components/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@base-template/ui/components/field";
import { Input } from "@base-template/ui/components/input";
import { useState, type FormEvent } from "react";

import { PasswordInput } from "../-components/password-input";
import { SectionCard } from "../-components/section-card";
import { SigePageHeader } from "../-components/page-header";
import { RoleBadge } from "../-components/tone-badge";
import { formatDateTime } from "../-lib/format";
import { useRole } from "../-lib/use-role";
import { currentUserFor, mockAction } from "../-mock";
import type { User } from "../-mock/types";

/** AUTH-04: personal data form, read-only account info and password change. */
export function ProfileScreen() {
  const role = useRole();
  const user = currentUserFor(role);
  // Keyed by user so switching role resets both forms to that user's data.
  return (
    <div className="flex flex-col gap-4">
      <SigePageHeader title="Mi Perfil" description="Datos personales y seguridad de tu cuenta" />
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <PersonalInfoCard key={user.id} user={user} />
        </div>
        <div className="flex flex-col gap-4 lg:col-span-2">
          <AccountInfoCard user={user} />
          <PasswordCard key={`password-${user.id}`} />
        </div>
      </div>
    </div>
  );
}

function PersonalInfoCard({ user }: { user: User }) {
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [email, setEmail] = useState(user.email ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [address, setAddress] = useState(user.address ?? "");
  const [submitted, setSubmitted] = useState(false);

  const invalid = (value: string) => submitted && value.trim().length === 0;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (!firstName.trim() || !lastName.trim() || !email.trim()) return;
    mockAction("Información actualizada", "Los cambios no se guardan en el prototipo.");
  };

  return (
    <SectionCard title="Información Personal">
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={invalid(firstName)}>
              <FieldLabel htmlFor="first-name">Nombre *</FieldLabel>
              <Input
                id="first-name"
                value={firstName}
                aria-invalid={invalid(firstName)}
                onChange={(event) => setFirstName(event.target.value)}
              />
              {invalid(firstName) ? <FieldError>El nombre es obligatorio.</FieldError> : null}
            </Field>
            <Field data-invalid={invalid(lastName)}>
              <FieldLabel htmlFor="last-name">Apellido *</FieldLabel>
              <Input
                id="last-name"
                value={lastName}
                aria-invalid={invalid(lastName)}
                onChange={(event) => setLastName(event.target.value)}
              />
              {invalid(lastName) ? <FieldError>El apellido es obligatorio.</FieldError> : null}
            </Field>
          </div>
          <Field data-invalid={invalid(email)}>
            <FieldLabel htmlFor="email">Correo Electrónico *</FieldLabel>
            <Input
              id="email"
              type="email"
              value={email}
              aria-invalid={invalid(email)}
              onChange={(event) => setEmail(event.target.value)}
            />
            {invalid(email) ? <FieldError>El correo es obligatorio.</FieldError> : null}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="phone">Teléfono</FieldLabel>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="address">Dirección</FieldLabel>
              <Input
                id="address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
              />
            </Field>
          </div>
        </FieldGroup>
        <div>
          <Button type="submit">Actualizar Información</Button>
        </div>
      </form>
    </SectionCard>
  );
}

function AccountInfoCard({ user }: { user: User }) {
  const rows: Array<[string, React.ReactNode]> = [
    [
      "Usuario",
      <span key="u" className="font-mono text-xs">
        {user.username}
      </span>,
    ],
    ["Rol", <RoleBadge key="r" role={user.role} />],
    ["Documento", `${user.documentType} ${user.documentNumber}`],
    ["Último Acceso", user.lastLogin ? formatDateTime(user.lastLogin) : "Nunca"],
  ];
  return (
    <SectionCard title="Información de Cuenta">
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-[13px]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </SectionCard>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!current || !next || !confirm) {
      setError("Completa los tres campos de contraseña.");
    } else if (next.length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres.");
    } else if (next !== confirm) {
      setError("Las contraseñas nuevas no coinciden.");
    } else if (next === current) {
      setError("La nueva contraseña debe ser diferente a la actual.");
    } else {
      setError(null);
      setCurrent("");
      setNext("");
      setConfirm("");
      mockAction("Contraseña actualizada", "El cambio no se guarda en el prototipo.");
    }
  };

  return (
    <SectionCard title="Cambiar Contraseña">
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="pw-current">Contraseña Actual *</FieldLabel>
            <PasswordInput
              id="pw-current"
              autoComplete="current-password"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="pw-next">Nueva Contraseña *</FieldLabel>
            <PasswordInput
              id="pw-next"
              autoComplete="new-password"
              value={next}
              onChange={(event) => setNext(event.target.value)}
            />
            <FieldDescription>Mínimo 6 caracteres</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="pw-confirm">Confirmar Contraseña *</FieldLabel>
            <PasswordInput
              id="pw-confirm"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </Field>
          {error ? <FieldError>{error}</FieldError> : null}
        </FieldGroup>
        <div>
          <Button type="submit" variant="outline">
            Cambiar Contraseña
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}
