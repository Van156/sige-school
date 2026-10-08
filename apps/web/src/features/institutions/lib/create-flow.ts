/** The calls `createInstitutionWithLogo` makes, injected so the flow stays free of the API client. */
export type CreateFlowDeps<TInput, TResult extends { institution: { id: string } }> = {
  create: (input: TInput) => Promise<TResult>;
  setLogo: (institutionId: string, logo: File) => Promise<unknown>;
};

export type CreateFlowResult<TResult> = {
  result: TResult;
  /** `false` when a logo was picked but its upload failed; the institution still exists. */
  logoUploaded: boolean;
};

/**
 * INS-02 create: the institution and its rector first, then the optional logo (which needs the
 * new institution's id). A failed create rejects and nothing was uploaded. A failed upload does
 * not undo the create: it is reported through `logoUploaded` so the user can retry from the edit
 * form instead of creating the institution twice.
 */
export async function createInstitutionWithLogo<
  TInput,
  TResult extends { institution: { id: string } },
>(
  deps: CreateFlowDeps<TInput, TResult>,
  input: TInput,
  logo: File | null,
): Promise<CreateFlowResult<TResult>> {
  const result = await deps.create(input);
  if (!logo) {
    return { result, logoUploaded: true };
  }
  try {
    await deps.setLogo(result.institution.id, logo);
  } catch {
    return { result, logoUploaded: false };
  }
  return { result, logoUploaded: true };
}
