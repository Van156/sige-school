import { describe, expect, mock, test } from "bun:test";

import { runDelete, type DeleteEffects } from "./delete-flow";

const row = { id: "c1", name: "Sede Norte" };

function effects(remove: DeleteEffects<typeof row>["remove"]) {
  return {
    remove: mock(remove),
    notifyError: mock((_title: string, _description: string) => undefined),
    notifySuccess: mock((_message: string) => undefined),
    refresh: mock(async () => undefined),
    successMessage: (r: typeof row) => `${r.name} eliminada`,
  } satisfies DeleteEffects<typeof row>;
}

describe("runDelete", () => {
  test("toasts the success and refreshes the list", async () => {
    const fx = effects(async () => ({ deleted: true }));
    await runDelete(row, fx);
    expect(fx.notifySuccess).toHaveBeenCalledWith("Sede Norte eliminada");
    expect(fx.refresh).toHaveBeenCalledTimes(1);
    expect(fx.notifyError).not.toHaveBeenCalled();
  });

  test("HAS_DEPENDENTS toasts the server message and resolves so the dialog closes", async () => {
    const fx = effects(async () => {
      throw { code: "HAS_DEPENDENTS", message: "Tiene niveles asociados." };
    });
    await runDelete(row, fx);
    expect(fx.notifyError).toHaveBeenCalledWith(
      "No se puede eliminar Sede Norte",
      "Tiene niveles asociados.",
    );
    expect(fx.notifySuccess).not.toHaveBeenCalled();
    expect(fx.refresh).not.toHaveBeenCalled();
  });

  test("any other failure toasts and rethrows so the dialog stays open", async () => {
    const failure = new Error("network down");
    const fx = effects(async () => {
      throw failure;
    });
    await expect(runDelete(row, fx)).rejects.toBe(failure);
    expect(fx.notifyError).toHaveBeenCalledWith("No se pudo eliminar Sede Norte", "network down");
    expect(fx.notifySuccess).not.toHaveBeenCalled();
    expect(fx.refresh).not.toHaveBeenCalled();
  });
});
