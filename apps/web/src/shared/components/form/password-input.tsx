import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@base-template/ui/components/input-group";
import { cn } from "@base-template/ui/lib/utils";
import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps } from "react";

/** Password field with a show/hide toggle. `large` matches the auth screens' `h-10` controls. */
export default function PasswordInput({
  large = false,
  className,
  ...props
}: Omit<ComponentProps<"input">, "type" | "size"> & { large?: boolean }) {
  const [visible, setVisible] = useState(false);
  return (
    <InputGroup className={cn(large && "h-10", className)}>
      <InputGroupInput
        {...props}
        type={visible ? "text" : "password"}
        size={large ? "lg" : "default"}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={visible}
          size="icon-xs"
          onClick={() => setVisible((value) => !value)}
        >
          {visible ? <EyeOff /> : <Eye />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}
