import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from '@/lib/date';

interface Activity {
  id: string;
  action: string;
  entityType: string;
  createdAt: string;
  user?: { firstName: string; lastName: string; email: string };
}

interface ActivityFeedProps {
  activities: Activity[];
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  return (
    <Card className="border-border/40 bg-background/60 backdrop-blur-md shadow-sm hover:shadow-md transition-shadow">
      <CardHeader>
        <CardTitle className="text-base">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent activity</p>
        ) : (
          activities.map((activity) => (
            <div key={activity.id} className="flex items-start gap-3">
              <div className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-medium">
                    {activity.user
                      ? `${activity.user.firstName} ${activity.user.lastName}`
                      : 'System'}
                  </span>{' '}
                  {activity.action.toLowerCase()} {activity.entityType}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(activity.createdAt)}
                </p>
              </div>
              <Badge variant="outline" className="shrink-0 text-[10px]">
                {activity.action}
              </Badge>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
