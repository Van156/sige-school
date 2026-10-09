import { Badge } from "@base-template/ui/components/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@base-template/ui/components/table";

import { HelpCard } from "@/features/institution";

import { EXAMPLE_BLOCKS } from "../lib/time-block-form";

/** SCH-10 side card "Ejemplo de bloques típicos" (sige/04 §5.2): a typical school day. */
export default function TypicalBlocksHelp() {
  return (
    <HelpCard title="Ejemplo de bloques típicos">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Orden</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Inicio</TableHead>
            <TableHead>Fin</TableHead>
            <TableHead>Tipo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {EXAMPLE_BLOCKS.map((block) => (
            <TableRow key={block.orderNum}>
              <TableCell>{block.orderNum}</TableCell>
              <TableCell>{block.name}</TableCell>
              <TableCell className="font-mono text-xs">{block.startTime}</TableCell>
              <TableCell className="font-mono text-xs">{block.endTime}</TableCell>
              <TableCell>
                <Badge variant={block.isBreak ? "warning" : "success"}>
                  {block.isBreak ? "Descanso" : "Clase"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </HelpCard>
  );
}
