import { Button } from "@base-template/ui/components/button";
import { FieldGroup } from "@base-template/ui/components/field";
import { ArrowLeft } from "lucide-react";
import type { FormEvent, ReactNode } from "react";

import { ScreenLinkButton } from "./link-button";
import { SectionCard } from "./section-card";

/** "Volver" button of every form header. */
export function BackButton({
  screenId,
  search,
  label = "Volver",
}: {
  screenId: string;
  search?: Record<string, string | undefined>;
  label?: string;
}) {
  return (
    <ScreenLinkButton screenId={screenId} search={search}>
      <ArrowLeft data-icon="inline-start" />
      {label}
    </ScreenLinkButton>
  );
}

/** Form card (2/3) next to a help card column (1/3); stacks on phones. */
export function FormLayout({ form, help }: { form: ReactNode; help: ReactNode }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">{form}</div>
      <div className="flex flex-col gap-4">{help}</div>
    </div>
  );
}

/** Form card with its submit and cancel buttons. */
export function FormCard({
  title,
  onSubmit,
  submitLabel,
  cancelScreenId,
  cancelSearch,
  children,
}: {
  title: string;
  onSubmit: (event: FormEvent) => void;
  submitLabel: string;
  /** Omit for forms without a cancel button (institution configuration). */
  cancelScreenId?: string;
  cancelSearch?: Record<string, string | undefined>;
  children: ReactNode;
}) {
  return (
    <SectionCard title={title}>
      <form className="flex flex-col gap-6" onSubmit={onSubmit} noValidate>
        <FieldGroup>{children}</FieldGroup>
        <div className="flex flex-wrap gap-2">
          <Button type="submit">{submitLabel}</Button>
          {cancelScreenId ? (
            <ScreenLinkButton screenId={cancelScreenId} search={cancelSearch}>
              Cancelar
            </ScreenLinkButton>
          ) : null}
        </div>
      </form>
    </SectionCard>
  );
}

/** Numbered group of fields inside a long form (user forms). */
export function FormSection({
  index,
  title,
  children,
}: {
  index: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <span
          aria-hidden="true"
          className="flex size-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground tabular-nums"
        >
          {index}
        </span>
        {title}
      </h3>
      <FieldGroup>{children}</FieldGroup>
    </section>
  );
}

/** Static help card (legacy "Información" / "Consejos" side panel). */
export function HelpCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <SectionCard title={title}>
      <div className="flex flex-col gap-2 text-[13px] text-muted-foreground">{children}</div>
    </SectionCard>
  );
}

export function HelpList({ items }: { items: readonly string[] }) {
  return (
    <ul className="ml-4 flex list-disc flex-col gap-1">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/** Live preview of the generated username (create-user forms). */
export function UsernamePreview({ username }: { username: string }) {
  return (
    <div className="grid gap-1 rounded-lg border bg-muted/40 px-3 py-2 text-[13px] sm:grid-cols-2">
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground">Username auto-generado</span>
        <span className="font-mono">
          {username || "Se genera al escribir nombre, apellido y documento"}
        </span>
      </div>
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground">Contraseña inicial</span>
        <span>Nº de documento</span>
      </div>
    </div>
  );
}
