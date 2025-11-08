import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, AlertTriangle, Clock } from "lucide-react";
import { Link } from "wouter";
import StatusBadge from "@/components/StatusBadge";
import PriorityIndicator from "@/components/PriorityIndicator";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
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

export default function OverdueGapsPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: userData } = useQuery<{ user: any }>({
    queryKey: ["/api/auth/me"],
  });

  const { data, isLoading } = useQuery<{ gaps: GapWithReporter[] }>({
    queryKey: ["/api/gaps"],
  });

  // Get the base path for gap links based on user role
  const getRoleBasePath = (role: string) => {
    switch (role) {
      case "Admin": return "/admin";
      case "Management": return "/management";
      case "POC": return "/poc";
      case "QA/Ops": return "/qa";
      default: return "/admin";
    }
  };

  const basePath = userData?.user ? getRoleBasePath(userData.user.role) : "/admin";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const gaps = data?.gaps || [];
  const now = new Date();

  // Filter for overdue gaps only
  const overdueGaps = gaps.filter((gap) => {
    const isOverdue = gap.status === "Overdue" || 
      (gap.tatDeadline && 
       new Date(gap.tatDeadline) < now && 
       !["Resolved", "Closed"].includes(gap.status));
    
    const matchesSearch = searchQuery === "" || 
      gap.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      gap.gapId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      gap.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return isOverdue && matchesSearch;
  });

  // Calculate overdue days
  const getOverdueDays = (tatDeadline: string | null) => {
    if (!tatDeadline) return 0;
    const deadline = new Date(tatDeadline);
    const diffTime = now.getTime() - deadline.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Sort by most overdue first
  const sortedGaps = [...overdueGaps].sort((a, b) => {
    const aDays = getOverdueDays(a.tatDeadline);
    const bDays = getOverdueDays(b.tatDeadline);
    return bDays - aDays; // Most overdue first
  });

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-status-overdue/10 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-status-overdue" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-status-overdue" data-testid="text-page-title">
              Overdue Gaps
            </h1>
            <p className="text-muted-foreground">
              {overdueGaps.length} {overdueGaps.length === 1 ? 'gap' : 'gaps'} requiring immediate attention
            </p>
          </div>
        </div>
      </div>

      {/* Alert Banner */}
      {overdueGaps.length > 0 && (
        <Card className="mb-6 border-status-overdue bg-status-overdue/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-status-overdue animate-pulse" />
              <CardTitle className="text-lg text-status-overdue">Action Required</CardTitle>
            </div>
            <CardDescription>
              These gaps have passed their TAT deadline and require immediate resolution
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search overdue gaps..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
        </CardContent>
      </Card>

      {/* Overdue Gaps List */}
      {sortedGaps.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchQuery ? "No overdue gaps match your search" : "No overdue gaps found"}
              </p>
              {searchQuery === "" && (
                <p className="text-sm text-muted-foreground mt-2">
                  Great job! All gaps are on track
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedGaps.map((gap) => {
            const overdueDays = getOverdueDays(gap.tatDeadline);
            
            return (
              <Card 
                key={gap.id} 
                className="border-l-4 border-l-status-overdue hover-elevate"
                data-testid={`card-gap-${gap.id}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="font-mono text-xs">
                          {gap.gapId}
                        </Badge>
                        <StatusBadge status={gap.status as any} />
                        <PriorityIndicator priority={gap.priority} />
                        <Badge variant="destructive" className="animate-pulse">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {overdueDays} {overdueDays === 1 ? 'day' : 'days'} overdue
                        </Badge>
                      </div>
                      <CardTitle className="text-xl">{gap.title}</CardTitle>
                      <CardDescription className="line-clamp-2">
                        {gap.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Reported By</p>
                      <p className="font-medium">{gap.reporter?.name || "Unknown"}</p>
                    </div>
                    {gap.assignee && (
                      <div>
                        <p className="text-muted-foreground">Assigned To</p>
                        <p className="font-medium">{gap.assignee.name}</p>
                      </div>
                    )}
                    {gap.department && (
                      <div>
                        <p className="text-muted-foreground">Department</p>
                        <p className="font-medium">{gap.department}</p>
                      </div>
                    )}
                    {gap.tatDeadline && (
                      <div>
                        <p className="text-muted-foreground">Deadline Was</p>
                        <p className="font-medium text-status-overdue">
                          {format(new Date(gap.tatDeadline), "MMM dd, yyyy")}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <Link href={`${basePath}/gaps/${gap.id}`}>
                      <Button variant="default" size="sm" data-testid={`button-view-gap-${gap.id}`}>
                        View Details
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
