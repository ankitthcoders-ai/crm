import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Zap, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { login, clearError } from '@/store/slices/authSlice';
import { toast } from 'sonner';



export function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { loading, error } = useAppSelector((s) => s.auth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(clearError());
    const result = await dispatch(login({ email, password }));
    if (login.fulfilled.match(result)) {
      toast.success('Welcome back!');
      navigate('/dashboard');
    } else {
      toast.error((result.payload as string) || 'Login failed');
    }
  };




  return (
    <div className="min-h-screen flex bg-background selection:bg-primary/20 selection:text-primary">
      <div className="relative hidden lg:flex lg:w-1/2 overflow-hidden flex-col justify-between text-white p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/80 to-purple-900 z-0" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay z-0" />
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] rounded-full bg-white/10 blur-[100px] z-0" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-500/20 blur-[80px] z-0" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 backdrop-blur-md shadow-inner border border-white/20">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight">Nexus CRM</span>
        </div>

        <div className="relative z-10">
          <h1 className="text-5xl font-bold leading-tight tracking-tight mb-6">
            Enterprise CRM <br /> HRMS + Projects
          </h1>
          <p className="text-lg text-white/80 max-w-md font-medium leading-relaxed">
            Unified platform for workforce management, payroll, and project delivery —
            inspired by modern design principles.
          </p>
        </div>
        <p className="relative z-10 text-sm text-white/60 font-medium">© 2026 Nexus CRM. All rights reserved.</p>
      </div>

      <div className="flex flex-1 items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-background z-0" />
        <div className="absolute top-[20%] right-[10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px] z-0 pointer-events-none" />
        <div className="absolute bottom-[10%] left-[10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[100px] z-0 pointer-events-none" />

        <Card className="w-full max-w-md border-border/40 shadow-2xl bg-background/60 backdrop-blur-xl relative z-10">
          <CardHeader className="text-center pb-8 pt-6">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 lg:hidden ring-1 ring-primary/20">
              <Zap className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="text-3xl tracking-tight font-bold">Welcome back</CardTitle>
            <CardDescription className="text-base mt-2">Enter your credentials to access your workspace</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2.5">
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="h-11 bg-muted/40 border-border/50 focus-visible:bg-background transition-colors"
                  required
                />
              </div>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  <Link to="/forgot-password" className="text-xs text-primary hover:text-primary/80 font-medium transition-colors">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 bg-muted/40 border-border/50 focus-visible:bg-background transition-colors"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              {error && <p className="text-sm text-destructive font-medium">{error}</p>}
              <Button type="submit" className="w-full h-11 text-base font-medium shadow-md transition-all hover:shadow-lg active:scale-[0.98]" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign in
              </Button>
            </form>

            <p className="mt-8 text-center text-sm text-muted-foreground">
              New company?{' '}
              <Link to="/register" className="text-primary font-medium hover:text-primary/80 transition-colors">
                Create account
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
