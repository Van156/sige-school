import { Button } from "@base-template/ui/components/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@base-template/ui/components/field";
import { Input } from "@base-template/ui/components/input";
import { Building2 } from "lucide-react";
import { useId, useState } from "react";

import { LOGO_ACCEPT, validateLogoFile } from "../lib/logo-file";

/**
 * Logo control of INS-06 (sige/02 INS-R10). Presentational: shows "Logo actual:", pre-checks the
 * picked file's type and size like the server, then hands it to `onUpload`, which rejects with a
 * message to show (the server stays authoritative). Upload and removal are separate calls from
 * the profile save.
 */
export default function LogoField({
  logo,
  disabled = false,
  isBusy = false,
  currentLabel = "Logo actual:",
  onUpload,
  onRemove,
}: {
  logo: string | null;
  /** Read-only callers: no controls. */
  disabled?: boolean;
  isBusy?: boolean;
  /** Caption next to the image; the create form shows a not-yet-uploaded pick as a selection. */
  currentLabel?: string;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const inputId = useId();
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se pudo actualizar el logo.");
    }
  }

  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={inputId}>Logo de la Institución</FieldLabel>
      <div className="flex items-center gap-3">
        {logo ? (
          <img src={logo} alt="Logo actual" className="size-14 rounded-md border object-contain" />
        ) : (
          <span
            aria-hidden="true"
            className="flex size-14 items-center justify-center rounded-md bg-muted text-muted-foreground"
          >
            <Building2 className="size-6" />
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-sm text-muted-foreground">{logo ? currentLabel : "Sin logo"}</span>
          {disabled ? null : (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id={inputId}
                type="file"
                accept={LOGO_ACCEPT}
                disabled={isBusy}
                aria-invalid={error ? true : undefined}
                onChange={(event) => {
                  const input = event.currentTarget;
                  const file = input.files?.[0];
                  input.value = "";
                  if (!file) {
                    return;
                  }
                  const problem = validateLogoFile(file);
                  if (problem) {
                    setError(problem);
                    return;
                  }
                  void run(() => onUpload(file));
                }}
              />
              {logo ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isBusy}
                  onClick={() => void run(onRemove)}
                >
                  Quitar logo
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </div>
      <FieldDescription>Formatos: PNG, JPG, JPEG, GIF, WEBP. Máximo 2 MB.</FieldDescription>
      {error ? <FieldError errors={[{ message: error }]} /> : null}
    </Field>
  );
}
