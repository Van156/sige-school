/** The part of a `user.create` result the confirmation needs (sige/03 §3.3). */
export type CreatedUser = {
  username: string;
  /** Set when the user is a student whose academic profile is still to be completed (D4/D8). */
  next: { screen: string; personId: string } | null;
};

/**
 * The success toast of USR-02 (USR-R3). A student account is only half a student, so it points at
 * the pending profile; there is no link yet because STU-03 does not exist (D8).
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
