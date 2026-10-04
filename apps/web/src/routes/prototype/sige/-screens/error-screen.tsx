import { Badge } from "@base-template/ui/components/badge";
import { Button } from "@base-template/ui/components/button";
import { useRouter } from "@tanstack/react-router";
import {
  FileQuestion,
  FileWarning,
  Gauge,
  Lock,
  ServerCrash,
  ShieldOff,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

import { ModeToggle } from "@/shared/components/layout/mode-toggle";

import { Callout } from "../-components/callout";
import { SigeLink } from "../-components/sige-link";
import { SigeLinkButton } from "../-components/link-button";

interface ErrorCopy {
  icon: LucideIcon;
  title: string;
  message: string;
}

const ERRORS: Record<string, ErrorCopy> = {
  "400": {
    icon: TriangleAlert,
    title: "Solicitud Incorrecta",
    message: "La solicitud no pudo ser procesada. Verifica los datos enviados.",
  },
  "401": {
    icon: Lock,
    title: "No Autorizado",
    message: "Debes iniciar sesión para acceder a esta página.",
  },
  "403": {
    icon: ShieldOff,
    title: "Acceso Prohibido",
    message: "No tienes permiso para acceder a esta página.",
  },
  "404": {
    icon: FileQuestion,
    title: "Página No Encontrada",
    message: "La página que buscas no existe o fue movida.",
  },
  "413": {
    icon: FileWarning,
    title: "Archivo Demasiado Grande",
    message: "El archivo que intentas subir supera el tamaño máximo permitido.",
  },
  "429": {
    icon: Gauge,
    title: "Demasiadas Solicitudes",
    message: "Has realizado demasiadas solicitudes. Intenta de nuevo en unos minutos.",
  },
  "500": {
    icon: ServerCrash,
    title: "Error Interno del Servidor",
    message: "Ha ocurrido un error inesperado. Por favor intente nuevamente.",
  },
};

const CODES = Object.keys(ERRORS);

/** AUTH-05: one screen for every HTTP error. Unknown codes fall back to 404. No shell. */
export function ErrorScreen({ code }: { code: string }) {
  const router = useRouter();
  const known = code in ERRORS;
  const shownCode = known ? code : "404";
  const copy = ERRORS[shownCode] as ErrorCopy;
  const Icon = copy.icon;
  const serverSide = Number(shownCode) >= 500;

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center gap-8 bg-background px-4 py-10">
      <div className="absolute top-3 right-3">
        <ModeToggle />
      </div>
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <span
          aria-hidden="true"
          className="flex size-12 items-center justify-center rounded-md bg-muted text-foreground"
        >
          <Icon className="size-6" />
        </span>
        <span className="text-5xl leading-none font-semibold tracking-[-0.01em] text-muted-foreground tabular-nums">
          {shownCode}
        </span>
        <h1 className="text-[28px] leading-9 font-semibold tracking-[-0.01em]">{copy.title}</h1>
        <p className="text-sm text-muted-foreground">{copy.message}</p>
        <div className="flex flex-wrap justify-center gap-2">
          {shownCode === "403" ? (
            <SigeLinkButton to="/prototype/sige/dashboard" variant="default">
              Volver al Inicio
            </SigeLinkButton>
          ) : (
            <>
              <Button variant="outline" onClick={() => router.history.back()}>
                Volver Atrás
              </Button>
              <SigeLinkButton to="/prototype/sige/dashboard" variant="default">
                Ir al Dashboard
              </SigeLinkButton>
            </>
          )}
        </div>
        {serverSide ? (
          <Callout tone="info" className="text-left">
            <strong className="font-medium text-foreground">Nota:</strong> Si el problema persiste,
            contacta al administrador del sistema.
          </Callout>
        ) : null}
      </div>
      <nav
        aria-label="Otros códigos de error (prototipo)"
        className="flex flex-wrap justify-center gap-1.5"
      >
        {CODES.map((item) => (
          <Badge
            key={item}
            variant={item === shownCode ? "default" : "outline"}
            render={<SigeLink to="/prototype/sige/error/$code" params={{ code: item }} />}
          >
            {item}
          </Badge>
        ))}
      </nav>
    </div>
  );
}
