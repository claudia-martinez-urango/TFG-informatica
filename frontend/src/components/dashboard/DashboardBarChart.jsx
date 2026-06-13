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

  return (
    <div className="bar-chart">
      {data.map((item, i) => {
        const raw     = item[valueKey] ?? 0;
        const pct     = max > 0 ? Math.min(100, Math.round((raw / max) * 100)) : 0;
        const label   = item[labelKey] ?? '—';
        const display = unit === '%'
          ? `${raw !== null ? raw : '—'}%`
          : `${raw}${unit ? ` ${unit}` : ''}`;

        return (
          <div
            key={i}
            className={`bar-chart-row${clickable ? ' bar-chart-row--clickable' : ''}`}
            onClick={clickable ? () => onBarClick(item) : undefined}
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') onBarClick(item); } : undefined}
          >
            <div className="bar-chart-label" title={label}>{label}</div>
            <div className="bar-chart-track">
              <div
                className={`bar-chart-bar bar-chart-bar--${color || 'primary'}`}
                style={{ width: `${Math.max(pct, raw > 0 ? 2 : 0)}%` }}
              >
                {pct > 18 && (
                  <span className="bar-chart-bar-value">{display}</span>
                )}
              </div>
            </div>
            <span className="bar-chart-out-value" aria-label={display}>
              {pct <= 18 ? display : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default DashboardBarChart;
