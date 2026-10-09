/** Date parts as zero-padded strings in `timeZone` (the browser's when omitted). */
function dateParts(iso: string, timeZone?: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    day: get("day"),
    month: get("month"),
    year: get("year"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

/** "dd/mm/yyyy" (sige/03 §5.3 "Creado"). */
export function formatUserDate(iso: string, timeZone?: string): string {
  const { day, month, year } = dateParts(iso, timeZone);
  return `${day}/${month}/${year}`;
}

/** "dd/mm/yyyy HH:MM", or "Nunca" for a user that never signed in (sige/03 §5.3 "Último acceso"). */
export function formatLastAccess(iso: string | null, timeZone?: string): string {
  if (iso === null) {
    return "Nunca";
  }
  const { hour, minute } = dateParts(iso, timeZone);
  return `${formatUserDate(iso, timeZone)} ${hour}:${minute}`;
}
