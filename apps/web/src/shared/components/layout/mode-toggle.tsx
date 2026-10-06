import { Button } from "@base-template/ui/components/button";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

/**
 * One-click light/dark toggle. Presentational: it only talks to the theme provider.
 * The icons swap through the `dark:` CSS variant, so the markup is identical on server and client;
 * `resolvedTheme` is only read on click, when it is always defined.
 */
export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
