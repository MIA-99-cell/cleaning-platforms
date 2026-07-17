import { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import './Notifications.css';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState({});
  const buttonRef = useRef(null);

  const fetchNotifications = () => {
    api.get('/notifications').then((res) => setNotifications(res.data.data || []));
  };

  useEffect(() => { fetchNotifications(); }, []);

  useEffect(() => {
    if (!open || !buttonRef.current) return undefined;

    const updatePosition = () => {
      const rect = buttonRef.current.getBoundingClientRect();
      const panelWidth = 320;
      const left = Math.max(12, Math.min(rect.right - panelWidth, window.innerWidth - panelWidth - 12));

      setPanelStyle({
        top: rect.bottom + 8,
        left,
        width: panelWidth,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markRead = async (id) => {
    await api.patch(`/notifications/${id}/read`);
    fetchNotifications();
  };

  const markAllRead = async () => {
    await api.patch('/notifications/read-all');
    fetchNotifications();
  };

  return (
    <div className="notifications-root">
      <button
        ref={buttonRef}
        type="button"
        className="icon-btn notifications-btn"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span className="notifications-badge">{unreadCount}</span>
        )}
      </button>

      {open && (
        <>
          <div className="notifications-backdrop" onClick={() => setOpen(false)} />
          <div className="card notifications-panel" style={panelStyle}>
            <div className="notifications-header">
              <strong>Notifications</strong>
              {unreadCount > 0 && (
                <button type="button" className="btn btn-outline btn-sm" onClick={markAllRead}>
                  Mark all read
                </button>
              )}
            </div>
            {notifications.length === 0 ? (
              <p className="notifications-empty">No notifications</p>
            ) : notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => !n.is_read && markRead(n.id)}
                className={`notifications-item${n.is_read ? '' : ' unread'}`}
              >
                <strong>{n.title}</strong>
                <p>{n.message}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Notifications;
