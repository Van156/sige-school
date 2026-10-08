import { Button } from "@base-template/ui/components/button";

/** The impersonation strip: what is being managed and the "Dejar de gestionar" action. */
export default function ImpersonationBannerView({
  message,
  isStopping,
  onStop,
}: {
  message: string;
  isStopping: boolean;
  onStop: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 bg-amber-500 px-4 py-2 text-sm font-medium text-black">
      <span>{message}</span>
      <Button
        size="sm"
        variant="outline"
        className="border-black/30 bg-transparent text-black hover:bg-black/10"
        disabled={isStopping}
        onClick={onStop}
      >
        {isStopping ? "Saliendo..." : "Dejar de gestionar"}
      </Button>
    </div>
  );
}
