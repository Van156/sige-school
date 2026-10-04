/**
 * Print mode of the printable screens (ATT-04, RPT-04): while mounted, `window.print()` hides the
 * app chrome (sidebar and top bar) and anything marked `data-print-hide`, leaving only the page.
 */
export function PrintStyles() {
  return (
    <style>{`
      @media print {
        [data-slot="sidebar"],
        [data-slot="sidebar-gap"],
        [data-slot="sidebar-inset"] > header,
        [data-print-hide] { display: none !important; }
        [data-slot="sidebar-inset"] { margin: 0 !important; box-shadow: none !important; }
        body { background: #fff !important; }
      }
    `}</style>
  );
}
