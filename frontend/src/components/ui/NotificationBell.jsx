import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';

const TYPE_ICON = {
  new_request: '🔔',
  approved:    '✅',
  rejected:    '❌',
};

function timeAgo(date) {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function NotificationBell() {
  const { notifications, unreadCount, markAllRead, dismiss } = useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const navigate = useNavigate();

  // Close dropdown when clicking outside
  useEffect(() => {
    function onClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  function handleOpen() {
    setOpen(prev => !prev);
    if (!open && unreadCount > 0) markAllRead();
  }

  function handleClick(notification) {
    dismiss(notification.id);
    setOpen(false);
    if (notification.link) navigate(notification.link);
  }

  return (
    <div className="notification-bell" ref={panelRef}>
      <button
        type="button"
        className="notification-bell-btn"
        onClick={handleOpen}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        🔔
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notification-dropdown">
          <div className="notification-dropdown-header">
            <span>Notifications</span>
            {notifications.length > 0 && (
              <button
                type="button"
                className="notification-clear-all"
                onClick={() => { notifications.forEach(n => dismiss(n.id)); }}
              >
                Clear all
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="notification-empty">No notifications yet.</p>
          ) : (
            <ul className="notification-list">
              {notifications.map(n => (
                <li
                  key={n.id}
                  className={`notification-item${n.read ? '' : ' notification-item--unread'}`}
                  onClick={() => handleClick(n)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter') handleClick(n); }}
                >
                  <span className="notification-icon">{TYPE_ICON[n.type] ?? '🔔'}</span>
                  <div className="notification-body">
                    <p className="notification-title">{n.title}</p>
                    <p className="notification-message">{n.message}</p>
                    <p className="notification-time">{timeAgo(n.timestamp)}</p>
                  </div>
                  <button
                    type="button"
                    className="notification-dismiss"
                    onClick={e => { e.stopPropagation(); dismiss(n.id); }}
                    aria-label="Dismiss"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
