import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

export type WorkspaceChartDatum = {
  name: string;
  value?: number;
  [key: string]: string | number | null | undefined;
};

export type WorkspaceChartSeries = {
  key: string;
  name: string;
  color?: string;
};

type WorkspaceChartProps = {
  data: WorkspaceChartDatum[];
  height?: number;
  emptyMessage?: string;
  valueFormatter?: (value: number) => string;
};

type WorkspaceSeriesChartProps = WorkspaceChartProps & {
  series: WorkspaceChartSeries[];
};

const chartPalette = [
  "#2563eb",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#64748b"
];

const axisStyle = {
  fill: "var(--color-base-content)",
  opacity: 0.68,
  fontSize: 12
};

const tooltipContentStyle = {
  background: "var(--color-base-100)",
  border: "1px solid color-mix(in oklab, var(--color-base-content) 14%, transparent)",
  borderRadius: "0.9rem",
  boxShadow: "0 18px 45px rgba(15, 23, 42, 0.18)",
  color: "var(--color-base-content)"
};

const tooltipLabelStyle = {
  color: "var(--color-base-content)",
  fontWeight: 700
};

export function WorkspacePieChart({
  data,
  height = 270,
  emptyMessage = "No chart data is available yet.",
  valueFormatter
}: WorkspaceChartProps) {
  const normalizedData = data.filter((item) => Number(item.value ?? 0) > 0);

  if (!normalizedData.length) {
    return <WorkspaceChartEmptyState height={height}>{emptyMessage}</WorkspaceChartEmptyState>;
  }

  return (
    <div className="min-w-0" style={{ height, minHeight: height, width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
            formatter={(value) => formatTooltipValue(value, valueFormatter)}
          />
          <Legend wrapperStyle={{ color: "var(--color-base-content)", fontSize: 12 }} />
          <Pie
            data={normalizedData}
            dataKey="value"
            nameKey="name"
            innerRadius="48%"
            outerRadius="78%"
            paddingAngle={2}
            stroke="var(--color-base-100)"
            strokeWidth={3}
          >
            {normalizedData.map((item, index) => (
              <Cell key={item.name} fill={chartPalette[index % chartPalette.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WorkspaceBarChart({
  data,
  series,
  height = 280,
  emptyMessage = "No chart data is available yet.",
  valueFormatter
}: WorkspaceSeriesChartProps) {
  if (!hasSeriesData(data, series)) {
    return <WorkspaceChartEmptyState height={height}>{emptyMessage}</WorkspaceChartEmptyState>;
  }

  return (
    <div className="min-w-0" style={{ height, minHeight: height, width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--color-base-content)" strokeDasharray="3 3" opacity={0.12} />
          <XAxis dataKey="name" tick={axisStyle} tickLine={false} axisLine={false} />
          <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={60} />
          <Tooltip
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
            formatter={(value) => formatTooltipValue(value, valueFormatter)}
          />
          <Legend wrapperStyle={{ color: "var(--color-base-content)", fontSize: 12 }} />
          {series.map((item, index) => (
            <Bar
              key={item.key}
              dataKey={item.key}
              name={item.name}
              fill={item.color ?? chartPalette[index % chartPalette.length]}
              radius={[8, 8, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WorkspaceLineChart({
  data,
  series,
  height = 280,
  emptyMessage = "No chart data is available yet.",
  valueFormatter
}: WorkspaceSeriesChartProps) {
  if (!hasSeriesData(data, series)) {
    return <WorkspaceChartEmptyState height={height}>{emptyMessage}</WorkspaceChartEmptyState>;
  }

  return (
    <div className="min-w-0" style={{ height, minHeight: height, width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--color-base-content)" strokeDasharray="3 3" opacity={0.12} />
          <XAxis dataKey="name" tick={axisStyle} tickLine={false} axisLine={false} />
          <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={60} />
          <Tooltip
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
            formatter={(value) => formatTooltipValue(value, valueFormatter)}
          />
          <Legend wrapperStyle={{ color: "var(--color-base-content)", fontSize: 12 }} />
          {series.map((item, index) => (
            <Line
              key={item.key}
              type="monotone"
              dataKey={item.key}
              name={item.name}
              stroke={item.color ?? chartPalette[index % chartPalette.length]}
              strokeWidth={3}
              dot={{ r: 4, strokeWidth: 2 }}
              activeDot={{ r: 6 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function WorkspaceChartEmptyState({ children, height }: { children: string; height: number }) {
  return (
    <div
      className="grid place-items-center rounded-box border border-dashed border-base-300/80 bg-base-200/35 px-4 text-center text-sm leading-6 text-base-content/65"
      style={{ minHeight: height }}
    >
      {children}
    </div>
  );
}

function hasSeriesData(data: WorkspaceChartDatum[], series: WorkspaceChartSeries[]) {
  return data.some((item) => series.some((entry) => Number(item[entry.key] ?? 0) !== 0));
}

function formatTooltipValue(value: unknown, valueFormatter?: (value: number) => string) {
  const numericValue = typeof value === "number" ? value : Number(value);

  if (Number.isFinite(numericValue)) {
    return valueFormatter ? valueFormatter(numericValue) : numericValue.toLocaleString("en-PH");
  }

  return String(value ?? "");
}
