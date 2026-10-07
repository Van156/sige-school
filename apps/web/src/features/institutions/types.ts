/** A row of `institutionAdmin.list` (sige/02 INS-01, P0 slice). */
export type InstitutionRow = {
  id: string;
  name: string;
  slug: string;
  createdAt: Date | string;
  rector: { userId: string; name: string; username: string | null } | null;
};

/** The part of `institutionAdmin.create`'s result the confirmation shows. */
export type CreatedInstitution = {
  institution: { id: string; name: string; slug: string };
  rector: { username: string };
};
