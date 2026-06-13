import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../auth/supabaseClient';
import { useAuth } from '../auth/AuthContext';

const NotificationContext = createContext(null);

export function useNotifications() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }) {
  const { user, profile } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const channelRef = useRef(null);

  const addNotification = useCallback((notification) => {
    setNotifications(prev =>
      [{ id: Date.now(), read: false, timestamp: new Date(), ...notification }, ...prev].slice(0, 20)
    );
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const dismiss = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  useEffect(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    if (!user || !profile) return;

    if (profile.role === 'teacher') {
      channelRef.current = supabase
        .channel('teacher-join-requests')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'folder_join_requests' },
          () => {
            addNotification({
              type:    'new_request',
              title:   'New join request',
              message: 'A student has requested to join one of your folders.',
              link:    '/teacher/folders',
            });
          }
        )
        .subscribe();
    }

    if (profile.role === 'student') {
      channelRef.current = supabase
        .channel(`student-requests-${user.id}`)
        .on(
          'postgres_changes',
          {
            event:  'UPDATE',
            schema: 'public',
            table:  'folder_join_requests',
            filter: `student_id=eq.${user.id}`,
          },
          (payload) => {
            const { status } = payload.new;
            if (status === 'approved') {
              addNotification({
                type:    'approved',
                title:   'Request approved!',
                message: 'You have been approved to join a folder. Check your dashboard.',
                link:    '/student/dashboard',
              });
            } else if (status === 'rejected') {
              addNotification({
                type:    'rejected',
                title:   'Request not approved',
                message: 'Your join request was not accepted by the teacher.',
                link:    '/join',
              });
            }
          }
        )
        .subscribe();
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user, profile, addNotification]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, addNotification, markAllRead, dismiss }}>
      {children}
    </NotificationContext.Provider>
  );
}
