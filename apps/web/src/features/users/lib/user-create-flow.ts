/** The part of a `user.create` result the confirmation needs (sige/03 §3.3). */
export type CreatedUser = {
  username: string;
  /** Set when the user is a student whose academic profile is still to be completed (D4/D8). */
  next: { screen: string; personId: string } | null;
};

/**
 * The success toast of USR-02 (USR-R3): "Usuario creado · contraseña inicial: Nº de documento.", or
 * for a student, whose account is only half a student, "Usuario creado · completa su perfil
 * académico." (the username sits in the description).
 */
export function createdUserNotice(created: CreatedUser): { title: string; description: string } {
  return {
    title: "Usuario creado",
    description:
      created.next === null
        ? `${created.username} · contraseña inicial: Nº de documento.`
        : `${created.username} · completa su perfil académico.`,
  };
}

/** Where USR-02 goes after a create (USR-R3, F4 path B). */
export type CreatedUserDestination =
  | { screen: "users" }
  | { screen: "complete-student-profile"; personId: string };

/**
 * A student lands on STU-03 "complete" for the new person, but only for a caller who may complete
 * profiles (`student:create`, else that page is a no-permission dead end); everyone else returns to
 * USR-01.
 */
export function createdUserDestination(
  created: Pick<CreatedUser, "next">,
  canCompleteProfile: boolean,
): CreatedUserDestination {
  if (created.next === null || !canCompleteProfile) {
    return { screen: "users" };
  }
  return { screen: "complete-student-profile", personId: created.next.personId };
}
