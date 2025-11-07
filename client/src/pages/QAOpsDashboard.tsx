import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import MetricCard from "@/components/MetricCard";
import GapCard from "@/components/GapCard";
import { FileText, CheckCircle, BookOpen, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";

export default function QAOpsDashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  const { data: metricsData, isLoading: metricsLoading } = useQuery<{
    totalRaised: number;
    validated: number;
    resolved: number;
    sopImpact: number;
    smoothnessScore: number;
  }>({
    queryKey: ["/api/gaps/my/metrics"],
  });

  const { data: gapsData, isLoading: gapsLoading } = useQuery<{
    gaps: Array<{
      id: number;
      gapId: string;
      title: string;
      description: string;
      status: string;
      priority: string;
      createdAt: string;
      reporter: { id: number; name: string; email: string } | null;
      assignee: { id: number; name: string; email: string } | null;
    }>;
  }>({
    queryKey: ["/api/gaps/my", { status: selectedStatus, search: searchQuery }],
  });

  const statuses = ["All", "Assigned", "InProgress", "Resolved", "Closed"];
  const gaps = gapsData?.gaps || [];
  const metrics = metricsData || {
    totalRaised: 0,
    validated: 0,
    resolved: 0,
    sopImpact: 0,
    smoothnessScore: 0,
  };

  return (
    <div className="space-y-6" data-testid="page-qa-dashboard">
      <div>
        <h1 className="text-2xl font-semibold mb-1">My Submissions</h1>
        <p className="text-sm text-muted-foreground">Track your reported process gaps</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          title="Total Gaps Raised" 
          value={metricsLoading ? "..." : metrics.totalRaised} 
          icon={FileText} 
        />
        <MetricCard 
          title="Validated Gaps" 
          value={metricsLoading ? "..." : metrics.validated} 
          icon={CheckCircle} 
        />
        <MetricCard 
          title="SOP Impact" 
          value={metricsLoading ? "..." : metrics.sopImpact} 
          icon={BookOpen} 
          subtitle="Led to new SOPs" 
        />
        <MetricCard 
          title="Smoothness Score" 
          value={metricsLoading ? "..." : metrics.smoothnessScore} 
          icon={TrendingUp} 
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My Gap Submissions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search gaps..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-gaps"
              />
            </div>
          </div>
          <div className="flex gap-2">
            {statuses.map((status) => (
              <Badge
                key={status}
                variant={selectedStatus === status ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setSelectedStatus(selectedStatus === status ? null : status)}
                data-testid={`badge-filter-${status.toLowerCase()}`}
              >
                {status}
              </Badge>
            ))}
          </div>
          <div className="space-y-4">
            {gapsLoading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Loading gaps...</p>
            ) : gaps.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">No gaps found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {searchQuery || selectedStatus ? "Try adjusting your filters" : "Submit your first gap to get started"}
                </p>
              </div>
            ) : (
              gaps.map((gap) => (
                <GapCard
                  key={gap.id}
                  id={gap.gapId}
                  title={gap.title}
                  description={gap.description}
                  status={gap.status as any}
                  priority={gap.priority as any}
                  reporter={gap.reporter?.name || "Unknown"}
                  assignedTo={gap.assignee?.name}
                  createdAt={new Date(gap.createdAt)}
                  onClick={() => console.log("Gap clicked:", gap.gapId)}
                />
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
