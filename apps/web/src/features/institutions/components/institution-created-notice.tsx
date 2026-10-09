import { buttonVariants } from "@base-template/ui/components/button";
import { Link } from "@tanstack/react-router";
import { CircleCheck } from "lucide-react";

import type { CreatedInstitution } from "../types";

/**
 * Confirmation after INS-02: the institution name, the generated rector username and the reminder
 * that the initial password is the document number (the rector must change it on first sign-in).
 */
export default function InstitutionCreatedNotice({
  created,
  logoWarning,
}: {
  created: CreatedInstitution;
  /** Set when the institution was created but its logo could not be uploaded. */
  logoWarning?: string;
}) {
  return (
    <section
      aria-labelledby="institution-created-title"
      className="flex flex-col gap-4 rounded-lg border bg-card p-6"
    >
      <div className="flex items-center gap-2">
        <CircleCheck aria-hidden="true" className="size-5 text-success" />
        <h2 id="institution-created-title" className="text-base font-semibold">
          Institución creada
        </h2>
      </div>
      <p className="text-sm">
        La institución <strong>{created.institution.name}</strong> fue creada con su administrador.
      </p>
      <dl className="grid gap-1 text-sm">
        <div className="flex gap-2">
          <dt className="text-muted-foreground">Username auto-generado:</dt>
          <dd className="font-mono font-medium">{created.rector.username}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground">Contraseña inicial:</dt>
          <dd>Nº de documento</dd>
        </div>
      </dl>
      <p className="text-sm text-muted-foreground">
        Deberá cambiarla en su primer inicio de sesión.
      </p>
      {logoWarning ? (
        <p
          role="status"
          className="rounded-md bg-warning/15 px-3 py-2 text-sm text-warning-foreground"
        >
          {logoWarning}
        </p>
      ) : null}
      <div>
        <Link to="/admin/instituciones" className={buttonVariants()}>
          Volver al listado
        </Link>
      </div>
    </section>
  );
}
