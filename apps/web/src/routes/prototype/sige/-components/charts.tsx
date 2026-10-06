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
  ReferenceLine,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

export interface BarDatum {
  label: string;
  value: number;
  /** CSS color (chart token); defaults to the series color. */
  color?: string;
}

export interface BarLegendItem {
  label: string;
  /** CSS color matching the bars it describes. */
  color: string;
}

/** Single-series bar chart with an optional per-bar color, fixed value domain, ticks and legend. */
export function CategoryBarChart({
  data,
  seriesLabel,
  domain,
  ticks,
  legend,
  ariaLabel,
  className,
  valueFormatter,
}: {
  data: readonly BarDatum[];
  seriesLabel: string;
  domain?: [number, number];
  /** Explicit Y ticks, e.g. `[1, 2, 3, 4, 5]` for scores. */
  ticks?: readonly number[];
  /** Names the per-bar colors; rendered under the chart when provided. */
  legend?: readonly BarLegendItem[];
  ariaLabel: string;
  className?: string;
  valueFormatter?: (value: number) => string;
}) {
  const config = { value: { label: seriesLabel, color: "var(--chart-1)" } } satisfies ChartConfig;
  return (
    <div className="flex flex-col gap-2">
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
            ticks={ticks ? [...ticks] : undefined}
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
      {legend && legend.length > 0 ? (
        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
          {legend.map((item) => (
            <li key={item.label} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="size-2.5 rounded-[2px]"
                style={{ backgroundColor: item.color }}
              />
              {item.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
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
  domain,
  decimals = false,
  ariaLabel,
  className,
}: {
  /** One object per category: `label` plus one numeric field per series key. */
  data: ReadonlyArray<{ label: string } & Record<string, string | number>>;
  series: readonly SeriesDef[];
  variant?: "bar" | "line";
  stacked?: boolean;
  /** Fixed value domain, e.g. `[0, 5]` for scores. */
  domain?: [number, number];
  /** Allows fractional ticks (scores); counts keep integer ticks. */
  decimals?: boolean;
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
      <YAxis
        tickLine={false}
        axisLine={false}
        width={32}
        allowDecimals={decimals}
        domain={domain}
      />
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

export interface ScatterSeries<P> {
  key: string;
  label: string;
  color: string;
  points: readonly P[];
}

/**
 * Scatter plot with one coloured series per group and an optional trend segment. `point` supplies
 * the numeric coordinates of a datum and `describe` the tooltip text.
 */
export function ScatterPlot<P extends { x: number; y: number }>({
  series,
  trend,
  xLabel,
  yLabel,
  xDomain,
  yDomain,
  describe,
  ariaLabel,
  className,
}: {
  series: readonly ScatterSeries<P>[];
  trend?: readonly [{ x: number; y: number }, { x: number; y: number }] | null;
  xLabel: string;
  yLabel: string;
  xDomain: [number, number];
  yDomain: [number, number];
  describe: (point: P) => string;
  ariaLabel: string;
  className?: string;
}) {
  const config = Object.fromEntries(
    series.map((entry) => [entry.key, { label: entry.label, color: entry.color }]),
  ) satisfies ChartConfig;
  return (
    <div className="flex flex-col gap-2">
      <ChartContainer
        config={config}
        className={className ?? "aspect-[16/9] w-full"}
        role="img"
        aria-label={ariaLabel}
      >
        <ScatterChart accessibilityLayer margin={{ left: -4, right: 8, top: 8, bottom: 16 }}>
          <CartesianGrid />
          <XAxis
            type="number"
            dataKey="x"
            name={xLabel}
            domain={xDomain}
            tickLine={false}
            label={{ value: xLabel, position: "insideBottom", offset: -8, fontSize: 12 }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name={yLabel}
            domain={yDomain}
            tickLine={false}
            width={36}
          />
          <ZAxis range={[60, 60]} />
          <ChartTooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              const datum = active ? (payload?.[0]?.payload as P | undefined) : undefined;
              if (!datum) return null;
              return (
                <div className="rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
                  {describe(datum)}
                </div>
              );
            }}
          />
          {trend ? (
            <ReferenceLine
              segment={[...trend]}
              stroke="var(--muted-foreground)"
              strokeDasharray="5 4"
              ifOverflow="extendDomain"
            />
          ) : null}
          {series.map((entry) => (
            <Scatter
              key={entry.key}
              name={entry.label}
              data={[...entry.points]}
              fill={`var(--color-${entry.key})`}
            />
          ))}
        </ScatterChart>
      </ChartContainer>
      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
        {series.map((entry) => (
          <li key={entry.key} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            {entry.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
