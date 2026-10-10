import { HelpCard } from "@/features/institution";

/** SCH-12 side card "Cómo funciona" (sige/04 §5.4). */
export default function GenerationHelp() {
  return (
    <HelpCard title="Cómo funciona">
      <ul className="list-disc pl-4">
        <li>Asigna cada materia a un salón y horario disponible.</li>
        <li>Evita conflictos de profesores y salones.</li>
        <li>Respeta los bloques de tiempo de cada sede.</li>
        <li>Permite ajustar manualmente después.</li>
      </ul>
      <p>Al generar, se reemplaza el horario existente de los grados seleccionados.</p>
    </HelpCard>
  );
}
