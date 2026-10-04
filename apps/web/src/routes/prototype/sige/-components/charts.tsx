import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@base-template/ui/components/chart";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

export interface BarDatum {
  label: string;
  value: number;
  /** CSS color (chart token); defaults to the series color. */
  color?: string;
}

/** Single-series bar chart with an optional per-bar color and a fixed value domain. */
export function CategoryBarChart({
  data,
  seriesLabel,
  domain,
  ariaLabel,
  className,
  valueFormatter,
}: {
  data: readonly BarDatum[];
  seriesLabel: string;
  domain?: [number, number];
  ariaLabel: string;
  className?: string;
  valueFormatter?: (value: number) => string;
}) {
  const config = { value: { label: seriesLabel, color: "var(--chart-1)" } } satisfies ChartConfig;
  return (
    <ChartContainer
      config={config}
      className={className ?? "aspect-[16/7] w-full"}
      role="img"
      aria-label={ariaLabel}
    >
      <BarChart accessibilityLayer data={[...data]} margin={{ left: -12, right: 4, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={0} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={40}
          domain={domain}
          tickFormatter={valueFormatter}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              hideLabel={false}
              formatter={(value) =>
                valueFormatter ? valueFormatter(Number(value)) : String(value)
              }
            />
          }
        />
        <Bar dataKey="value" fill="var(--color-value)" radius={2} maxBarSize={44}>
          {data.map((datum) => (
            <Cell key={datum.label} fill={datum.color ?? "var(--color-value)"} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
