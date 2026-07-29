import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { addNotification } from '@/store/slices/notificationSlice';
import { toast } from 'sonner';

const WS_URL = import.meta.env.VITE_WS_URL || '';

let socketInstance: Socket | null = null;

export const getSocket = () => socketInstance;

function getAccessToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)accessToken=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function useSocket() {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) {
      socketInstance?.disconnect();
      socketInstance = null;
      return;
    }

    const token = getAccessToken();
    if (!token) return;

    socketInstance = io(WS_URL || window.location.origin, {
      auth: { token },
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    });

    socketInstance.on('notification:new', (notification) => {
      dispatch(addNotification(notification));
      toast.info(notification.title, { description: notification.message });
    });

    return () => {
      socketInstance?.disconnect();
      socketInstance = null;
    };
  }, [isAuthenticated, dispatch]);
}
