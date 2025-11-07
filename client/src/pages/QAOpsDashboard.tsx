import { useState } from "react";
import MetricCard from "@/components/MetricCard";
import GapCard from "@/components/GapCard";
import { FileText, CheckCircle, BookOpen, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function QAOpsDashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  const mockSubmissions: any[] = [];

  const statuses = ["All", "Assigned", "InProgress", "Resolved", "Closed"];

  return (
    <div className="space-y-6" data-testid="page-qa-dashboard">
      <div>
        <h1 className="text-2xl font-semibold mb-1">My Submissions</h1>
        <p className="text-sm text-muted-foreground">Track your reported process gaps</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard title="Total Gaps Raised" value={28} icon={FileText} />
        <MetricCard title="Validated Gaps" value={24} icon={CheckCircle} />
        <MetricCard title="SOP Impact" value={8} icon={BookOpen} subtitle="Led to new SOPs" />
        <MetricCard title="Smoothness Score" value={18.6} icon={TrendingUp} trend={{ value: 12, isPositive: true }} />
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
            {mockSubmissions.map((gap) => (
              <GapCard
                key={gap.id}
                {...gap}
                onClick={() => console.log("Gap clicked:", gap.id)}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
