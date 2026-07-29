import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Download, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, getApiErrorMessage } from '@/lib/api';
import { useAppSelector } from '@/store/hooks';
import { ROLES } from '@crm/shared';

interface AttendanceReport {
  stats?: {
    totalRecords: number;
    presentCount: number;
    absentCount: number;
    lateCount: number;
  };
}

interface PayrollReport {
  totals?: {
    count: number;
    baseSalaryTotal: number;
    netSalaryTotal: number;
  };
}

interface ProjectsReport {
  data?: Array<{ id: string; name: string; status: string; progress: number }>;
}

interface ProductivityReport {
  data?: Array<{ id: string; name: string; completionRate: number; presentDays: number }>;
}

export function ReportsPage() {
  const user = useAppSelector((s) => s.auth.user);
  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState<AttendanceReport | null>(null);
  const [payroll, setPayroll] = useState<PayrollReport | null>(null);
  const [projects, setProjects] = useState<ProjectsReport | null>(null);
  const [productivity, setProductivity] = useState<ProductivityReport | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState(today);

  const canPayrollReport = user?.role === ROLES.HR || user?.role === ROLES.SUPER_ADMIN;
  const canProductivity = user?.role === ROLES.MANAGER || user?.role === ROLES.SUPER_ADMIN;

  const month = useMemo(() => new Date().getMonth() + 1, []);
  const year = useMemo(() => new Date().getFullYear(), []);
  const [exporting, setExporting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const calls = [
        api.get('/reports/attendance', { params: { startDate, endDate } }),
        api.get('/reports/projects'),
      ];
      if (canPayrollReport) {
        calls.push(api.get('/reports/payroll', { params: { month, year } }));
      }
      if (canProductivity) {
        calls.push(api.get('/reports/productivity'));
      }

      const responses = await Promise.all(calls);
      setAttendance(responses[0].data.data ?? null);
      setProjects(responses[1].data.data ?? null);

      let idx = 2;
      if (canPayrollReport) {
        setPayroll(responses[idx].data.data ?? null);
        idx += 1;
      } else {
        setPayroll(null);
      }
      if (canProductivity) {
        setProductivity(responses[idx].data.data ?? null);
      } else {
        setProductivity(null);
      }
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleExport = async (format: 'pdf' | 'csv' | 'json') => {
    setExporting(true);
    try {
      const response = await api.get('/reports/payroll/export', {
        params: { month, year, format },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const disposition = response.headers['content-disposition'] ?? '';
      const match = disposition.match(/filename="?(.+?)"?$/);
      link.download = match?.[1] ?? `payroll-report-${month}-${year}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-7 w-7 text-primary" />
          Reports & Analytics
        </h1>
        <p className="text-muted-foreground">Attendance, payroll, project and productivity insights</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Report Range</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>Start date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>End date</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <Button onClick={load} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Attendance records</p>
            <p className="text-2xl font-bold">{attendance?.stats?.totalRecords ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Present</p>
            <p className="text-2xl font-bold">{attendance?.stats?.presentCount ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Active projects</p>
            <p className="text-2xl font-bold">{projects?.data?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Payroll items</p>
            <p className="text-2xl font-bold">{payroll?.totals?.count ?? 0}</p>
            {canPayrollReport && (
              <div className="flex gap-1 mt-2">
                <Button size="sm" variant="outline" disabled={exporting} onClick={() => handleExport('pdf')} title="Download PDF report">
                  <FileText className={`h-4 w-4 mr-1 ${exporting ? 'animate-pulse' : ''}`} />
                  PDF
                </Button>
                <Button size="sm" variant="ghost" disabled={exporting} onClick={() => handleExport('csv')} title="Download CSV">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Project Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(projects?.data ?? []).slice(0, 8).map((p) => (
            <div key={p.id} className="flex items-center justify-between border-b pb-2">
              <div>
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.progress}% complete</p>
              </div>
              <Badge variant="outline">{p.status}</Badge>
            </div>
          ))}
          {(projects?.data?.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">No project data yet.</p>
          )}
        </CardContent>
      </Card>

      {canProductivity && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Productivity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(productivity?.data ?? [])
              .sort((a, b) => b.completionRate - a.completionRate)
              .slice(0, 6)
              .map((p) => (
                <div key={p.id} className="flex items-center justify-between border-b pb-2">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {p.completionRate.toFixed(0)}% completion · {p.presentDays} days present
                  </p>
                </div>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
