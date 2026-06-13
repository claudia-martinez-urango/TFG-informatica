import { Link } from 'react-router-dom';

function DashboardQuickActions({ actions }) {
  if (!actions || actions.length === 0) return null;

  return (
    <div className="dashboard-quick-actions">
      {actions.map((action) => {
        const cardClass = [
          'dashboard-action-card',
          action.variant ? `dashboard-action-card--${action.variant}` : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <Link key={`${action.url}-${action.label}`} to={action.url} className={cardClass}>
            <div className="dashboard-action-label">{action.label}</div>
            {action.description && (
              <div className="dashboard-action-desc">{action.description}</div>
            )}
          </Link>
        );
      })}
    </div>
  );
}

export default DashboardQuickActions;
