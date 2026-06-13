function DashboardStatCard({ label, value, helperText, icon, variant }) {
  const cardClass = [
    'dashboard-stat-card',
    variant ? `dashboard-stat-card--${variant}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cardClass}>
      {icon && <div className="dashboard-stat-icon">{icon}</div>}
      <div className="dashboard-stat-value">
        {value !== null && value !== undefined ? value : '—'}
      </div>
      <div className="dashboard-stat-label">{label}</div>
      {helperText && <div className="dashboard-stat-helper">{helperText}</div>}
    </div>
  );
}

export default DashboardStatCard;
