import { Card, CardContent, CardHeader, CardTitle } from "@base-template/ui/components/card";
import { Spinner } from "@base-template/ui/components/spinner";

/** SCH-12 card "Generando..." (sige/04 §5.4): shown while `schedule.generate` runs. */
export default function GenerationProgress() {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Generando...</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 text-sm" role="status">
          <Spinner />
          <div className="flex flex-col">
            <span className="font-medium">Generando horario...</span>
            <span className="text-muted-foreground">
              El sistema está optimizando la asignación de horarios
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
