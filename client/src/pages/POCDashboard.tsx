import MetricCard from "@/components/MetricCard";
import GapCard from "@/components/GapCard";
import { ListChecks, XCircle, TrendingDown, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function POCDashboard() {
  const mockAssignedGaps = [
    {
      id: "GAP-1234",
      title: "Refund process missing customer notification",
      description: "When processing refunds, customers are not receiving email confirmations.",
      status: "Overdue" as const,
      priority: "High" as const,
      reporter: "Sarah Chen",
      assignedTo: "Mike Torres",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72),
    },
    {
      id: "GAP-1189",
      title: "Inventory sync delay between warehouse and system",
      description: "Stock levels not updating in real-time causing overselling.",
      status: "InProgress" as const,
      priority: "High" as const,
      reporter: "Tom Anderson",
      assignedTo: "Mike Torres",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
    },
    {
      id: "GAP-1156",
      title: "Customer feedback form submission errors",
      description: "Form validation preventing legitimate submissions.",
      status: "Assigned" as const,
      priority: "Medium" as const,
      reporter: "Emma Davis",
      assignedTo: "Mike Torres",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6),
    },
  ];

  return (
    <div className="space-y-6" data-testid="page-poc-dashboard">
      <div>
        <h1 className="text-2xl font-semibold mb-1">My Assigned Gaps</h1>
        <p className="text-sm text-muted-foreground">Track and resolve assigned process gaps</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard title="Assigned Gaps" value={12} icon={ListChecks} />
        <MetricCard title="Closed Gaps" value={45} icon={CheckCircle} trend={{ value: 15, isPositive: true }} />
        <MetricCard title="TAT Breaches" value={3} icon={XCircle} />
        <MetricCard title="Reopen Rate" value="6.7%" icon={TrendingDown} subtitle="Below target" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Priority Queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {mockAssignedGaps.map((gap) => (
            <GapCard
              key={gap.id}
              {...gap}
              onClick={() => console.log("Gap clicked:", gap.id)}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
