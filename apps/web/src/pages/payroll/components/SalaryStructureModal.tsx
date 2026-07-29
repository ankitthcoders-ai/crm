import { useState, useEffect } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api, getApiErrorMessage } from '@/lib/api';

interface Employee {
  id: string;
  employeeCode: string;
  user: { firstName: string; lastName: string };
}

interface SalaryStructureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function SalaryStructureModal({ open, onOpenChange, onSuccess }: SalaryStructureModalProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    employeeId: '',
    baseSalary: '',
    effectiveFrom: new Date().toISOString().split('T')[0],
    allowances: [] as Array<{ label: string; amount: string }>,
    deductions: [] as Array<{ label: string; amount: string }>,
  });

  useEffect(() => {
    if (open) {
      loadEmployees();
    }
  }, [open]);

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/employees', { params: { limit: 100, status: 'ACTIVE' } });
      setEmployees(data.data ?? []);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employeeId) {
      return toast.error('Please select an employee');
    }

    setSubmitting(true);
    try {
      await api.post('/payroll/salary-structures', {
        ...form,
        baseSalary: Number(form.baseSalary),
        allowances: form.allowances.map((a) => ({ ...a, amount: Number(a.amount) })),
        deductions: form.deductions.map((d) => ({ ...d, amount: Number(d.amount) })),
      });
      toast.success('Salary structure saved');
      onSuccess();
      onOpenChange(false);
      setForm({
        employeeId: '',
        baseSalary: '',
        effectiveFrom: new Date().toISOString().split('T')[0],
        allowances: [],
        deductions: [],
      });
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const addAllowance = () => setForm({ ...form, allowances: [...form.allowances, { label: '', amount: '' }] });
  const addDeduction = () => setForm({ ...form, deductions: [...form.deductions, { label: '', amount: '' }] });

  const updateArray = (type: 'allowances' | 'deductions', index: number, field: string, value: string) => {
    const newArray = [...form[type]];
    newArray[index] = { ...newArray[index], [field]: value };
    setForm({ ...form, [type]: newArray });
  };

  const removeArray = (type: 'allowances' | 'deductions', index: number) => {
    const newArray = [...form[type]];
    newArray.splice(index, 1);
    setForm({ ...form, [type]: newArray });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Set Salary Structure</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Employee</Label>
                <Select value={form.employeeId} onValueChange={(v) => setForm({ ...form, employeeId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.user.firstName} {e.user.lastName} ({e.employeeCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Effective From</Label>
                <Input
                  type="date"
                  value={form.effectiveFrom}
                  onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Base Salary (Monthly)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.baseSalary}
                  onChange={(e) => setForm({ ...form, baseSalary: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Allowances</Label>
                <Button type="button" variant="outline" size="sm" onClick={addAllowance}>
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>
              {form.allowances.map((a, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input placeholder="e.g. Housing" value={a.label} onChange={(e) => updateArray('allowances', i, 'label', e.target.value)} required />
                  <Input type="number" placeholder="Amount" value={a.amount} onChange={(e) => updateArray('allowances', i, 'amount', e.target.value)} required className="w-32" />
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeArray('allowances', i)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Deductions</Label>
                <Button type="button" variant="outline" size="sm" onClick={addDeduction}>
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>
              {form.deductions.map((d, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input placeholder="e.g. Health Insurance" value={d.label} onChange={(e) => updateArray('deductions', i, 'label', e.target.value)} required />
                  <Input type="number" placeholder="Amount" value={d.amount} onChange={(e) => updateArray('deductions', i, 'amount', e.target.value)} required className="w-32" />
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeArray('deductions', i)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Structure
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
