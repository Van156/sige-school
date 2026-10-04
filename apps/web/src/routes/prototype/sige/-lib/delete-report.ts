import { mockAction, mockError, type DeleteResult } from "../-mock";

/** Toast for a guarded deletion: the success title, or the reason the entity has dependents. */
export function reportDelete(result: DeleteResult, successTitle: string, name: string) {
  if (result.ok) {
    mockAction(successTitle, `${name} se eliminó de los datos en memoria.`);
  } else {
    mockError(`No se puede eliminar ${name}`, result.reason);
  }
}
