import { useEffect, useState } from 'react';
import {
  Users,
  FolderKanban,
  Clock,
  Wallet,
  CalendarDays,
  TrendingUp,
  CheckSquare,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import { StatCard } from '@/components/dashboard/StatCard';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppSelector } from '@/store/hooks';
import { api } from '@/lib/api';
import { ROLES } from '@crm/shared';

interface DashboardStats {
  totalEmployees?: number;
  activeProjects?: number;
  todayAttendance?: number;
  pendingLeaves?: number;
  employees?: number;
  projects?: number;
  tasks?: number;
  myTasks?: number;
  assignedTasks?: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    project?: { name: string } | null;
  }>;
  recentActivities?: Array<{
    id: string;
    action: string;
    entityType: string;
    createdAt: string;
    user?: { firstName: string; lastName: string; email: string };
  }>;
  employeeGrowth?: Array<{ month: string; count: number }>;
  revenue?: { total: number; growth: number };
}

export function DashboardPage() {
  const user = useAppSelector((s) => s.auth.user);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/dashboard/stats')
      .then((res) => setStats(res.data.data))
      .catch(() => setStats({}))
      .finally(() => setLoading(false));
  }, []);

  const role = user?.role;
  const isSuperAdmin = role === ROLES.SUPER_ADMIN;
  const isEmployee = role === ROLES.EMPLOYEE;

  const growthData = stats?.employeeGrowth?.length
    ? stats.employeeGrowth
    : [
        { month: 'Jan', count: 12 },
        { month: 'Feb', count: 18 },
        { month: 'Mar', count: 24 },
        { month: 'Apr', count: 28 },
        { month: 'May', count: 32 },
      ];

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Good {getGreeting()}, {user?.firstName}
        </h1>
        <p className="text-muted-foreground">
          {isSuperAdmin
            ? 'Company overview and SaaS analytics'
            : `Your ${role?.toLowerCase().replace('_', ' ')} dashboard`}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {!isEmployee && (
          <StatCard
            title="Employees"
            value={stats?.totalEmployees ?? stats?.employees ?? 0}
            icon={Users}
            trend={isSuperAdmin ? { value: 12, label: 'vs last month' } : undefined}
          />
        )}
        <StatCard
          title="Active Projects"
          value={stats?.activeProjects ?? stats?.projects ?? 0}
          icon={FolderKanban}
        />
        <StatCard
          title="Today's Attendance"
          value={stats?.todayAttendance ?? 0}
          icon={Clock}
        />
        <StatCard
          title="Pending Leaves"
          value={stats?.pendingLeaves ?? 0}
          icon={CalendarDays}
          description={isEmployee ? 'Your pending requests' : 'Awaiting approval'}
        />
        <StatCard
          title="My Tasks"
          value={stats?.myTasks ?? stats?.tasks ?? 0}
          icon={CheckSquare}
          description="Assigned to you"
        />
      </div>

      {isSuperAdmin && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Revenue"
            value={`$${(stats?.revenue?.total ?? 0).toLocaleString()}`}
            icon={TrendingUp}
            trend={{ value: stats?.revenue?.growth ?? 8, label: 'growth' }}
          />
          <StatCard title="Open Tasks" value={stats?.tasks ?? 0} icon={CheckSquare} />
          <StatCard title="Payroll (Month)" value="—" icon={Wallet} description="Phase 3" />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border/40 bg-background/60 backdrop-blur-md shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-base">Employee Growth</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={growthData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <ActivityFeed activities={stats?.recentActivities ?? []} />
      </div>

      {isEmployee && (
        <Card className="border-border/40 bg-background/60 backdrop-blur-md shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-base">My Assigned Tasks</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!stats?.assignedTasks?.length ? (
              <p className="p-6 text-sm text-muted-foreground">No tasks assigned to you yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">Task</th>
                      <th className="text-left p-3 font-medium">Project</th>
                      <th className="text-left p-3 font-medium">Priority</th>
                      <th className="text-left p-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.assignedTasks.map((task) => (
                      <tr key={task.id} className="border-b">
                        <td className="p-3 font-medium">{task.title}</td>
                        <td className="p-3">{task.project?.name ?? '—'}</td>
                        <td className="p-3">{task.priority}</td>
                        <td className="p-3">{task.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isSuperAdmin && (
        <Card className="border-border/40 bg-background/60 backdrop-blur-md shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-base">Attendance Trend</CardTitle>
          </CardHeader>
          <CardContent className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={[
                  { day: 'Mon', count: 42 },
                  { day: 'Tue', count: 45 },
                  { day: 'Wed', count: 44 },
                  { day: 'Thu', count: 40 },
                  { day: 'Fri', count: 38 },
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}
