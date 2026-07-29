import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Moon,
  Sun,
  LogOut,
  Menu,
  Search,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { logout } from '@/store/slices/authSlice';
import { setTheme } from '@/store/slices/themeSlice';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { setNotifications } from '@/store/slices/notificationSlice';
import { NotificationPanel } from './NotificationPanel';

interface NavbarProps {
  onMenuClick?: () => void;
}

export function Navbar({ onMenuClick }: NavbarProps) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  const theme = useAppSelector((s) => s.theme.theme);

  const initials = user
    ? `${user.firstName[0]}${user.lastName[0]}`
    : 'U';

  const handleLogout = async () => {
    await dispatch(logout());
    navigate('/login');
  };

  const toggleTheme = () => {
    dispatch(setTheme(theme === 'dark' ? 'light' : 'dark'));
  };

  useEffect(() => {
    api
      .get('/notifications/unread', { params: { limit: 20 } })
      .then((res) => dispatch(setNotifications(res.data.data ?? [])))
      .catch(() => null);
  }, [dispatch]);

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur px-4 lg:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
        <Menu className="h-5 w-5" />
      </Button>

      <div className="relative flex-1 max-w-md hidden sm:block">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search employees, tasks, projects..." className="pl-9" />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <NotificationPanel />

        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        <Button variant="ghost" size="icon" onClick={() => navigate('/profile')}>
          <User className="h-5 w-5" />
        </Button>

        <div className="hidden md:flex items-center gap-2 pl-2 border-l">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
          </Avatar>
          <div className="text-sm">
            <p className="font-medium leading-none">
              {user?.firstName} {user?.lastName}
            </p>
            <Badge variant="outline" className="mt-1 text-[10px] px-1 py-0">
              {user?.role}
            </Badge>
          </div>
        </div>

        <Button variant="ghost" size="icon" onClick={handleLogout}>
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
