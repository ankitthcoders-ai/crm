import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { getNavigationForRole } from '@/config/navigation';
import { useAppSelector } from '@/store/hooks';
import { ROLE_LABELS, type RoleName } from '@crm/shared';
import { Badge } from '@/components/ui/badge';
import { CompanyBrandMark, useCompanyDisplayName } from './CompanyBrandMark';

export function Sidebar() {
  const user = useAppSelector((s) => s.auth.user);
  const companyName = useCompanyDisplayName();
  const role = (user?.role || 'EMPLOYEE') as RoleName;
  const navItems = getNavigationForRole(role);

  return (
    <aside className="hidden lg:flex w-64 flex-col border-r border-border/40 bg-background/40 backdrop-blur-xl text-sidebar-foreground z-30">
      <div className="flex h-16 items-center gap-3 border-b border-border/40 px-6">
        <CompanyBrandMark />
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">{companyName}</p>
          <p className="text-xs text-muted-foreground font-medium">Enterprise Suite</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1.5 p-4 overflow-y-auto scrollbar-none">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 group relative overflow-hidden',
                isActive
                  ? 'bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-md shadow-primary/20 ring-1 ring-primary/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
                <item.icon className={cn("h-4 w-4 shrink-0 transition-transform duration-200", isActive ? "scale-110" : "group-hover:scale-110 group-hover:text-primary")} />
                <span className="relative z-10">{item.title}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border/40 p-4">
        <Badge variant="outline" className="w-full justify-center py-1.5 bg-background/50 backdrop-blur-sm border-border/50 shadow-sm">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/80 font-semibold">
            {ROLE_LABELS[role]}
          </span>
        </Badge>
      </div>
    </aside>
  );
}
