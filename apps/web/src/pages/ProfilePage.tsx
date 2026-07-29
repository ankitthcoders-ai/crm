import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAppSelector } from '@/store/hooks';
import { ROLE_LABELS } from '@crm/shared';
import { api, getApiErrorMessage } from '@/lib/api';
import { toast } from 'sonner';

export function ProfilePage() {
  const user = useAppSelector((s) => s.auth.user);
  const initials = user ? `${user.firstName[0]}${user.lastName[0]}` : 'U';

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Profile</h1>
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-lg bg-primary/10 text-primary">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <CardTitle>
              {user?.firstName} {user?.lastName}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <Badge className="mt-2">
              {user?.role && ROLE_LABELS[user.role as keyof typeof ROLE_LABELS]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Employee ID</p>
              <p className="font-medium">{user?.employeeId || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Company ID</p>
              <p className="font-medium font-mono text-xs">{user?.companyId}</p>
            </div>
          </div>
          <div>
            <p className="text-muted-foreground text-sm mb-2">Permissions ({user?.permissions.length})</p>
            <div className="flex flex-wrap gap-1">
              {user?.permissions.slice(0, 12).map((p) => (
                <Badge key={p} variant="outline" className="text-[10px]">
                  {p}
                </Badge>
              ))}
              {(user?.permissions.length ?? 0) > 12 && (
                <Badge variant="secondary">+{(user?.permissions.length ?? 0) - 12} more</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const currentPassword = fd.get('currentPassword') as string;
              const newPassword = fd.get('newPassword') as string;
              const confirmPassword = fd.get('confirmPassword') as string;

              if (newPassword !== confirmPassword) {
                toast.error('New passwords do not match');
                return;
              }

              try {
                await api.post('/auth/change-password', { currentPassword, newPassword });
                toast.success('Password changed successfully');
                (e.target as HTMLFormElement).reset();
              } catch (err) {
                toast.error(getApiErrorMessage(err));
              }
            }}
            className="space-y-4 max-w-sm"
          >
            <div className="space-y-2">
              <label className="text-sm font-medium">Current Password</label>
              <input 
                name="currentPassword" 
                type="password" 
                required 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">New Password</label>
              <input 
                name="newPassword" 
                type="password" 
                required
                minLength={8}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Confirm New Password</label>
              <input 
                name="confirmPassword" 
                type="password" 
                required
                minLength={8}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <button 
              type="submit"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
            >
              Update Password
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
