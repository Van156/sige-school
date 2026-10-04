import { cn } from "@base-template/ui/lib/utils";

import { passwordStrength } from "../-lib/password-strength";

const SEGMENT_TONE = ["bg-destructive", "bg-warning", "bg-warning", "bg-success", "bg-success"];

/** Five-segment strength bar with a live text label. */
export function StrengthMeter({ password }: { password: string }) {
  const { level, label } = passwordStrength(password);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-5 gap-1" aria-hidden="true">
        {SEGMENT_TONE.map((tone, index) => (
          <span
            key={tone + index}
            className={cn("h-1 rounded-full bg-muted", index < level && tone)}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground" aria-live="polite">
        {label}
      </span>
    </div>
  );
}
