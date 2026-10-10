import { Alert, AlertDescription } from "@base-template/ui/components/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@base-template/ui/components/card";
import { NativeSelect, NativeSelectOption } from "@base-template/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { UsersRound } from "lucide-react";
import type { ReactNode } from "react";

import FormField from "@/shared/components/form/form-field";
import SubmitButton from "@/shared/components/form/submit-button";

import {
  candidatesNotice,
  GUARDIAN_LINK_DEFAULTS,
  GUARDIAN_RELATIONSHIP_OPTIONS,
  guardianLinkValidator,
  hasNoCandidates,
  type CandidatesStatus,
  type GuardianLinkFormValues,
} from "../lib/student-guardians";
import type { GuardianCandidate } from "../types";
import GuardianCandidateCombobox from "./guardian-candidate-combobox";

/**
 * STU-04 card "Asignar Nuevo Acudiente" (sige/05 §5.4, STU-R6): "Seleccionar Acudiente" (search
 * as you type), "Parentesco / Relación" and "Asignar Acudiente". With no guardian account left to
 * link it shows "No hay acudientes creados en la institución." and `createGuardian` (the USR-02
 * link for callers who may create accounts), else "Pida al administrador…". Presentational:
 * `onSubmit` rejects when the link failed; `error` is the server's reason, shown above the button.
 * The form resets after a successful link.
 */
export default function GuardianAssignCard({
  candidates,
  status,
  term,
  error,
  createGuardian,
  onSearchChange,
  onSubmit,
}: {
  candidates: readonly GuardianCandidate[];
  status: CandidatesStatus;
  /** The (debounced) search the candidates were fetched with. */
  term: string;
  error?: string | null;
  createGuardian?: ReactNode;
  onSearchChange: (search: string) => void;
  onSubmit: (values: GuardianLinkFormValues) => Promise<void>;
}) {
  const form = useForm({
    defaultValues: GUARDIAN_LINK_DEFAULTS,
    validators: { onSubmit: guardianLinkValidator },
    onSubmit: async ({ value, formApi }) => {
      try {
        await onSubmit(value);
      } catch {
        // The container exposes the failure through `error`; keep the choices to retry.
        return;
      }
      formApi.reset();
      onSearchChange("");
    },
  });
  const notice = candidatesNotice(status);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Asignar Nuevo Acudiente</CardTitle>
      </CardHeader>
      <CardContent>
        {hasNoCandidates(status, term, candidates) ? (
          <div className="flex flex-col items-start gap-2 text-[13px] text-muted-foreground">
            <p>No hay acudientes creados en la institución.</p>
            {createGuardian ?? <p>Pida al administrador que cree la cuenta del acudiente.</p>}
          </div>
        ) : (
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit();
            }}
          >
            <form.Field name="guardianPersonId">
              {(field) => (
                <FormField field={field} label="Seleccionar Acudiente *" description={notice}>
                  {(control) => (
                    <GuardianCandidateCombobox
                      control={control}
                      candidates={candidates}
                      status={status}
                      onSearchChange={onSearchChange}
                    />
                  )}
                </FormField>
              )}
            </form.Field>
            <form.Field name="relationship">
              {(field) => (
                <FormField field={field} label="Parentesco / Relación *">
                  {(control) => (
                    <NativeSelect {...control} className="w-full">
                      {GUARDIAN_RELATIONSHIP_OPTIONS.map((option) => (
                        <NativeSelectOption key={option.value} value={option.value}>
                          {option.label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  )}
                </FormField>
              )}
            </form.Field>
            {error ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <div>
              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(isSubmitting) => (
                  <SubmitButton isPending={isSubmitting}>
                    {isSubmitting ? null : <UsersRound data-icon="inline-start" />}
                    Asignar Acudiente
                  </SubmitButton>
                )}
              </form.Subscribe>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
