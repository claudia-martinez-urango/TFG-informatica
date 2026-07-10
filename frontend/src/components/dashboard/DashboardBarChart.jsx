import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from 'recharts';

const COLOR_VARS = {
  primary: 'var(--primary)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  info: '#38bdf8',
  muted: 'var(--text-light)',
};

const ROW_HEIGHT = 40;

function formatValue(raw, unit) {
  if (unit === '%') return `${raw !== null && raw !== undefined ? raw : '—'}%`;
  return `${raw}${unit ? ` ${unit}` : ''}`;
}

function CustomTooltip({ active, payload, unit }) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0].payload;

  return (
    <div className="bar-chart-tooltip">
      <strong>{item.__label}</strong>
      <span>{formatValue(item.__value, unit)}</span>
    </div>
  );
}

function DashboardBarChart({ data, labelKey, valueKey, maxValue, unit, color, emptyMessage, onBarClick }) {
  if (!data || data.length === 0) {
    return (
      <div className="dashboard-empty-state" style={{ padding: '16px' }}>
        {emptyMessage || 'No data available yet.'}
      </div>
    );
  }

  const max = maxValue ?? Math.max(...data.map((d) => d[valueKey] ?? 0), 1);
  const clickable = typeof onBarClick === 'function';
  const fill = COLOR_VARS[color] || COLOR_VARS.primary;

  const chartData = data.map((item) => ({
    __label: item[labelKey] ?? '—',
    __value: item[valueKey] ?? 0,
    __original: item,
  }));

  return (
    <div className="bar-chart">
      <ResponsiveContainer width="100%" height={chartData.length * ROW_HEIGHT + 20}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 40, bottom: 4, left: 4 }}
          barCategoryGap={12}
        >
          <XAxis type="number" domain={[0, max]} hide />
          <YAxis
            type="category"
            dataKey="__label"
            width={150}
            tick={{ fontSize: 12, fontWeight: 600, fill: 'var(--text-muted)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={<CustomTooltip unit={unit} />}
            cursor={{ fill: 'var(--surface-alt)' }}
          />
          <Bar
            dataKey="__value"
            radius={[999, 999, 999, 999]}
            label={{
              position: 'right',
              formatter: (value) => formatValue(value, unit),
              fill: 'var(--text-muted)',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={index}
                fill={fill}
                cursor={clickable ? 'pointer' : 'default'}
                onClick={clickable ? () => onBarClick(entry.__original) : undefined}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default DashboardBarChart;
