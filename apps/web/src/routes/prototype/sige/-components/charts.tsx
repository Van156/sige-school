import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@base-template/ui/components/chart";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

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

export interface SeriesDef {
  key: string;
  label: string;
  /** CSS color, e.g. `var(--success)`. */
  color: string;
}

/** Multi-series chart over a shared category axis: grouped or stacked bars, or lines. */
export function SeriesChart({
  data,
  series,
  variant = "bar",
  stacked = false,
  ariaLabel,
  className,
}: {
  /** One object per category: `label` plus one numeric field per series key. */
  data: ReadonlyArray<{ label: string } & Record<string, string | number>>;
  series: readonly SeriesDef[];
  variant?: "bar" | "line";
  stacked?: boolean;
  ariaLabel: string;
  className?: string;
}) {
  const config = Object.fromEntries(
    series.map((entry) => [entry.key, { label: entry.label, color: entry.color }]),
  ) satisfies ChartConfig;
  const axes = (
    <>
      <CartesianGrid vertical={false} />
      <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
      <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
      <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
      <ChartLegend content={<ChartLegendContent />} />
    </>
  );
  return (
    <ChartContainer
      config={config}
      className={className ?? "aspect-[16/8] w-full"}
      role="img"
      aria-label={ariaLabel}
    >
      {variant === "line" ? (
        <LineChart accessibilityLayer data={[...data]} margin={{ left: -12, right: 8, top: 8 }}>
          {axes}
          {series.map((entry) => (
            <Line
              key={entry.key}
              dataKey={entry.key}
              type="monotone"
              stroke={`var(--color-${entry.key})`}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          ))}
        </LineChart>
      ) : (
        <BarChart accessibilityLayer data={[...data]} margin={{ left: -12, right: 4, top: 8 }}>
          {axes}
          {series.map((entry) => (
            <Bar
              key={entry.key}
              dataKey={entry.key}
              fill={`var(--color-${entry.key})`}
              stackId={stacked ? "total" : undefined}
              radius={stacked ? 0 : 2}
              maxBarSize={32}
            />
          ))}
        </BarChart>
      )}
    </ChartContainer>
  );
}

export interface DonutDatum {
  label: string;
  value: number;
  color: string;
}

/** Doughnut chart with a legend; slices with a zero value are kept so the legend stays stable. */
export function DonutChart({
  data,
  ariaLabel,
  className,
}: {
  data: readonly DonutDatum[];
  ariaLabel: string;
  className?: string;
}) {
  const config = Object.fromEntries(
    data.map((datum) => [datum.label, { label: datum.label, color: datum.color }]),
  ) satisfies ChartConfig;
  return (
    <ChartContainer
      config={config}
      className={className ?? "mx-auto aspect-square max-h-64 w-full"}
      role="img"
      aria-label={ariaLabel}
    >
      <PieChart accessibilityLayer>
        <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="label" />} />
        <Pie
          data={[...data]}
          dataKey="value"
          nameKey="label"
          innerRadius="55%"
          outerRadius="85%"
          strokeWidth={2}
        >
          {data.map((datum) => (
            <Cell key={datum.label} fill={datum.color} />
          ))}
        </Pie>
        <ChartLegend content={<ChartLegendContent nameKey="label" />} />
      </PieChart>
    </ChartContainer>
  );
}
