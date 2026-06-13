const TYPE_CONFIG = {
  folder:        { label: 'Folder',       variant: 'primary' },
  reading:       { label: 'Reading',      variant: 'info'    },
  glossary_term: { label: 'Glossary',     variant: 'success' },
  join_request:  { label: 'Join Request', variant: 'warning' },
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', {
    day:   'numeric',
    month: 'short',
    year:  'numeric',
  });
}

function RecentActivityList({ activities }) {
  if (!activities || activities.length === 0) {
    return (
      <div className="dashboard-empty-state">
        No recent activity yet.
      </div>
    );
  }

  return (
    <div className="recent-activity-list">
      {activities.map((item) => {
        const config = TYPE_CONFIG[item.item_type] || { label: item.item_type, variant: 'muted' };
        return (
          <div key={item.item_id} className="recent-activity-item">
            <span className={`badge badge--${config.variant}`}>{config.label}</span>
            <div className="recent-activity-info">
              <span className="recent-activity-title">{item.title}</span>
              {item.subtitle && (
                <span className="recent-activity-subtitle">{item.subtitle}</span>
              )}
            </div>
            <span className="recent-activity-date">{formatDate(item.created_at)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default RecentActivityList;
