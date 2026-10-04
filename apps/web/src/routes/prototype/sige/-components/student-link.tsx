import { ScreenLink } from "./sige-link";

/** Student name that links to a per-student screen (`?student=`). */
export function StudentLink({
  screenId,
  studentId,
  children,
}: {
  screenId: string;
  studentId: number;
  children: string;
}) {
  return (
    <ScreenLink
      screenId={screenId}
      search={{ student: String(studentId) }}
      className="font-medium underline-offset-4 outline-none hover:underline focus-visible:underline"
    >
      {children}
    </ScreenLink>
  );
}
