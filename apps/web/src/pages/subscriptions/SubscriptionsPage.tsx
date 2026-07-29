import { useEffect, useState } from 'react';
import { CreditCard, Sparkles, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiErrorMessage } from '@/lib/api';

interface Plan {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  monthlyPrice: string | number;
  maxUsers: number;
  maxProjects: number;
  features: string[];
}

interface Subscription {
  id: string;
  plan: string;
  status: string;
  maxUsers: number;
  maxProjects: number;
  renewsAt: string | null;
  trialEndsAt: string | null;
  planDetails?: Plan | null;
}

interface Invoice {
  id: string;
  amount: string | number;
  status: string;
  dueDate: string;
  paidAt: string | null;
}

interface AiInsight {
  riskScore: string;
  category: string;
  message: string;
  recommendation: string;
}

export function SubscriptionsPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [aiInsights, setAiInsights] = useState<AiInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [plansRes, subRes, invRes] = await Promise.all([
        api.get('/subscriptions/plans'),
        api.get('/subscriptions/current'),
        api.get('/subscriptions/invoices'),
      ]);
      setPlans(
        (plansRes.data.data ?? []).map((p: Plan & { features: unknown }) => ({
          ...p,
          features: Array.isArray(p.features) ? p.features : [],
        }))
      );
      setSubscription(subRes.data.data ?? null);
      setInvoices(invRes.data.data ?? []);

      try {
        const aiRes = await api.get('/subscriptions/ai/leaves');
        setAiInsights(aiRes.data.data?.insights ?? []);
      } catch {
        setAiInsights([]);
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

  const upgrade = async (planId: string) => {
    setUpgrading(true);
    try {
      const res = await api.post('/subscriptions/checkout', { planId });
      toast.success('Plan upgrade initiated');
      if (res.data.data?.url) {
        toast.message(`Checkout: ${res.data.data.url}`);
      }
      load();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setUpgrading(false);
    }
  };

  const cancel = async () => {
    try {
      await api.post('/subscriptions/cancel');
      toast.success('Subscription cancelled');
      load();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <CreditCard className="h-7 w-7 text-primary" />
          Subscription & Billing
        </h1>
        <p className="text-muted-foreground">Plans, billing, and AI-powered insights</p>
      </div>

      {loading ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <>
          {subscription && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Current Plan</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-4">
                <div>
                  <p className="text-2xl font-bold">
                    {subscription.planDetails?.displayName ?? subscription.plan}
                  </p>
                  <Badge className="mt-1">{subscription.status}</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>Users: {subscription.maxUsers}</p>
                  <p>Projects: {subscription.maxProjects}</p>
                  {subscription.renewsAt && (
                    <p>Renews: {new Date(subscription.renewsAt).toLocaleDateString()}</p>
                  )}
                </div>
                <Button variant="outline" onClick={cancel}>
                  Cancel subscription
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <Card key={plan.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="text-base">{plan.displayName}</CardTitle>
                  <p className="text-2xl font-bold">
                    ₹{Number(plan.monthlyPrice).toLocaleString('en-IN')}
                    <span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </p>
                </CardHeader>
                <CardContent className="space-y-3 flex flex-col h-full">
                  <p className="text-sm text-muted-foreground">{plan.description || plan.name}</p>
                  <p className="text-xs">
                    Up to {plan.maxUsers} users · {plan.maxProjects} projects
                  </p>
                  <ul className="space-y-2 mt-4 text-sm text-muted-foreground flex-1">
                    {plan.features?.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="pt-4 mt-auto">
                    <Button
                      className="w-full"
                      size="sm"
                      disabled={upgrading}
                      onClick={() => upgrade(plan.id)}
                    >
                      Select plan
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invoices</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {invoices.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No invoices yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium">Amount</th>
                        <th className="text-left p-3 font-medium">Status</th>
                        <th className="text-left p-3 font-medium">Due</th>
                        <th className="text-left p-3 font-medium">Paid</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="border-b">
                          <td className="p-3">₹{Number(inv.amount).toLocaleString('en-IN')}</td>
                          <td className="p-3">
                            <Badge variant="outline">{inv.status}</Badge>
                          </td>
                          <td className="p-3">{new Date(inv.dueDate).toLocaleDateString()}</td>
                          <td className="p-3">
                            {inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                AI Leave Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {aiInsights.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  AI insights require a plan with the ai_insights feature (Enterprise or wildcard).
                </p>
              ) : (
                aiInsights.map((insight, i) => (
                  <div key={i} className="rounded-md border p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={insight.riskScore === 'HIGH' ? 'warning' : 'outline'}>
                        {insight.riskScore}
                      </Badge>
                      <span className="font-medium text-sm">{insight.category}</span>
                    </div>
                    <p className="text-sm">{insight.message}</p>
                    <p className="text-xs text-muted-foreground mt-2">{insight.recommendation}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
