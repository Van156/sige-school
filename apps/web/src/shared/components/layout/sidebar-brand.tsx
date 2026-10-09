/**
 * Product identity block for the sidebar header: logo, name and subtitle. Icon-collapsed, only the
 * logo remains. Presentational; the container supplies the brand values.
 */
export default function SidebarBrand({
  name,
  subtitle,
  logoSrc,
}: {
  name: string;
  subtitle: string;
  logoSrc: string;
}) {
  return (
    <div className="flex items-center gap-3 px-2 py-1.5">
      {/* The name sits next to the logo, so the image is decorative. */}
      <img src={logoSrc} alt="" width={32} height={32} className="size-8 shrink-0" />
      <span className="grid min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
        <span className="truncate text-sm font-semibold">{name}</span>
        <span className="truncate text-xs text-sidebar-foreground/70">{subtitle}</span>
      </span>
    </div>
  );
}
