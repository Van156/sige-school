import type { UsernamePreviewState } from "../lib/username-preview";

const PLACEHOLDER = "Se genera al escribir nombre, apellido y documento";

function usernameText(state: UsernamePreviewState): string {
  switch (state.status) {
    case "ready":
      return state.username;
    case "loading":
      return "Generando...";
    case "unavailable":
      return "No se pudo generar el nombre de usuario.";
    case "error":
      return "No se pudo generar la vista previa.";
    case "idle":
      return PLACEHOLDER;
  }
}

/**
 * USR-R2 preview box: the generated username and the initial password rule. Presentational: the
 * caller owns the debounced `user.previewUsername` query and passes its state.
 */
export default function UsernamePreviewBox({ state }: { state: UsernamePreviewState }) {
  const documentTaken =
    (state.status === "ready" || state.status === "unavailable") && state.documentTaken;
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-[13px]">
      <div className="grid gap-1 sm:grid-cols-2">
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">Username auto-generado</span>
          <span className="font-mono" aria-live="polite">
            {usernameText(state)}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">Contraseña inicial</span>
          <span>Nº de documento</span>
        </div>
      </div>
      {documentTaken ? (
        <p className="text-xs text-destructive" role="status">
          Ya existe un usuario con este documento.
        </p>
      ) : null}
    </div>
  );
}
