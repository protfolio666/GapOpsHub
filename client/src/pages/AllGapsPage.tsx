import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, Search, FileText } from "lucide-react";
import { Link } from "wouter";
import StatusBadge from "@/components/StatusBadge";
import PriorityIndicator from "@/components/PriorityIndicator";
import type { Gap } from "@shared/schema";

interface GapWithReporter extends Gap {
  reporter?: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
  assignee?: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
}

export default function AllGapsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading } = useQuery<{ gaps: GapWithReporter[] }>({
    queryKey: ["/api/gaps"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const gaps = data?.gaps || [];

  // Filter gaps
  const filteredGaps = gaps.filter((gap) => {
    const matchesStatus = statusFilter === "all" || gap.status === statusFilter;
    const matchesSearch = searchQuery === "" || 
      gap.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      gap.gapId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      gap.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesStatus && matchesSearch;
  });

  // Count by status
  const statusCounts = {
    all: gaps.length,
    PendingAI: gaps.filter(g => g.status === "PendingAI").length,
    NeedsReview: gaps.filter(g => g.status === "NeedsReview").length,
    Assigned: gaps.filter(g => g.status === "Assigned").length,
    InProgress: gaps.filter(g => g.status === "InProgress").length,
    Resolved: gaps.filter(g => g.status === "Resolved").length,
    Closed: gaps.filter(g => g.status === "Closed").length,
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">All Process Gaps</h1>
            <p className="text-muted-foreground">View and manage all submitted process gaps</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All ({statusCounts.all})</SelectItem>
                  <SelectItem value="PendingAI">Pending AI ({statusCounts.PendingAI})</SelectItem>
                  <SelectItem value="NeedsReview">Needs Review ({statusCounts.NeedsReview})</SelectItem>
                  <SelectItem value="Assigned">Assigned ({statusCounts.Assigned})</SelectItem>
                  <SelectItem value="InProgress">In Progress ({statusCounts.InProgress})</SelectItem>
                  <SelectItem value="Resolved">Resolved ({statusCounts.Resolved})</SelectItem>
                  <SelectItem value="Closed">Closed ({statusCounts.Closed})</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by ID, title, or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gaps List */}
      {filteredGaps.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No gaps found matching your filters</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredGaps.map((gap) => (
            <Card key={gap.id} className="hover-elevate" data-testid={`card-gap-${gap.id}`}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <Link href={`/admin/gaps/${gap.id}`}>
                        <span className="font-mono text-sm text-primary hover:underline cursor-pointer" data-testid={`text-gap-id-${gap.id}`}>
                          {gap.gapId}
                        </span>
                      </Link>
                      <StatusBadge status={gap.status as any} />
                      <PriorityIndicator priority={gap.priority as any} />
                    </div>

                    <Link href={`/admin/gaps/${gap.id}`}>
                      <h3 className="text-lg font-semibold mb-2 hover:text-primary cursor-pointer" data-testid={`text-gap-title-${gap.id}`}>
                        {gap.title}
                      </h3>
                    </Link>

                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {gap.description}
                    </p>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {gap.reporter && (
                        <span>
                          Reported by: <strong>{gap.reporter.name}</strong>
                        </span>
                      )}
                      {gap.assignee && (
                        <span>
                          Assigned to: <strong>{gap.assignee.name}</strong>
                        </span>
                      )}
                      {gap.department && (
                        <span>
                          Dept: <strong>{gap.department}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <Link href={`/admin/gaps/${gap.id}`}>
                      <Button variant="outline" size="sm" data-testid={`button-view-gap-${gap.id}`}>
                        View Details
                      </Button>
                    </Link>
                    {gap.tatDeadline && (
                      <span className="text-xs text-muted-foreground">
                        Due: {new Date(gap.tatDeadline).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
