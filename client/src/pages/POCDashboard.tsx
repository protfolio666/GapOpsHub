import MetricCard from "@/components/MetricCard";
import GapCard from "@/components/GapCard";
import { ListChecks, XCircle, TrendingDown, CheckCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { Gap } from "@shared/schema";

interface GapWithReporter extends Gap {
  reporter?: {
    id: number;
    name: string;
    email: string;
  };
  assignee?: {
    id: number;
    name: string;
    email: string;
  };
}

export default function POCDashboard() {
  const [, navigate] = useLocation();

  const { data: gapsData, isLoading } = useQuery<{ gaps: GapWithReporter[] }>({
    queryKey: ["/api/gaps"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const allGaps = gapsData?.gaps || [];

  // Calculate metrics from real data
  const assignedGaps = allGaps.filter(g => ['Assigned', 'InProgress'].includes(g.status));
  const closedGaps = allGaps.filter(g => g.status === 'Closed');
  const tatBreaches = allGaps.filter(g => g.status === 'Overdue' || (g.tatDeadline && new Date(g.tatDeadline) < new Date() && !['Resolved', 'Closed'].includes(g.status)));
  const reopenedGaps = allGaps.filter(g => g.reopenedAt !== null);
  const reopenRate = closedGaps.length > 0 ? ((reopenedGaps.length / closedGaps.length) * 100).toFixed(1) : "0.0";

  // Sort by priority: Overdue first, then High priority
  const priorityQueue = [...allGaps]
    .filter(g => !['Closed', 'Resolved'].includes(g.status))
    .sort((a, b) => {
      if (a.status === 'Overdue' && b.status !== 'Overdue') return -1;
      if (a.status !== 'Overdue' && b.status === 'Overdue') return 1;
      if (a.priority === 'High' && b.priority !== 'High') return -1;
      if (a.priority !== 'High' && b.priority === 'High') return 1;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

  return (
    <div className="space-y-6" data-testid="page-poc-dashboard">
      <div>
        <h1 className="text-2xl font-semibold mb-1">My Assigned Gaps</h1>
        <p className="text-sm text-muted-foreground">Track and resolve assigned process gaps</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard title="Assigned Gaps" value={assignedGaps.length} icon={ListChecks} />
        <MetricCard title="Closed Gaps" value={closedGaps.length} icon={CheckCircle} />
        <MetricCard title="TAT Breaches" value={tatBreaches.length} icon={XCircle} />
        <MetricCard title="Reopen Rate" value={`${reopenRate}%`} icon={TrendingDown} subtitle={parseFloat(reopenRate) < 10 ? "Below target" : "Above target"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Priority Queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {priorityQueue.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No gaps assigned to you</p>
          ) : (
            priorityQueue.map((gap) => (
              <GapCard
                key={gap.id}
                id={gap.gapId}
                title={gap.title}
                description={gap.description}
                status={gap.status as any}
                priority={gap.priority as any}
                reporter={gap.reporter?.name || "Unknown"}
                assignedTo={gap.assignee?.name || "Unassigned"}
                createdAt={new Date(gap.createdAt)}
                onClick={() => navigate(`/poc/gaps/${gap.id}`)}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
