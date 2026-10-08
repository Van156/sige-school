import { Card, CardContent, CardHeader, CardTitle } from "@base-template/ui/components/card";
import type { ReactNode } from "react";

/**
 * Two-column frame of the structure forms (sige/02 §5.2): the form card on the left, help cards
 * ("Información", "Consejos") on the right. Slots only.
 */
export default function FormPageLayout({ form, help }: { form: ReactNode; help?: ReactNode }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div>{form}</div>
      {help ? <aside className="flex flex-col gap-4">{help}</aside> : null}
    </div>
  );
}

/** A side card of a form page. */
export function HelpCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
        {children}
      </CardContent>
    </Card>
  );
}
