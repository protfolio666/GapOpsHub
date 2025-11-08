import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Clock, RefreshCcw, AlertCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import UserAvatar from "@/components/UserAvatar";

interface ReopenHistoryItem {
  gapId: string;
  gapTitle: string;
  reopenCount: number;
  reopenDates: string[];
  resolutions: Array<{
    resolvedAt: string;
    resolution: string;
  }>;
}

interface PocPerformance {
  poc: {
    id: number;
    name: string;
    email: string;
    employeeId: string;
  };
  metrics: {
    totalAssigned: number;
    totalResolved: number;
    totalReopened: number;
    reopenRate: string;
    totalTatExtensions: number;
    totalDelayed: number;
    delayedRate: string;
  };
  reopenHistory: ReopenHistoryItem[];
}

export default function POCPerformancePage({ isAdmin = false }: { isAdmin?: boolean }) {
  const { data: performanceData, isLoading } = useQuery<{ performance: PocPerformance[] | PocPerformance }>({
    queryKey: isAdmin ? ["/api/poc-performance"] : ["/api/poc-performance/me"],
  });

  const performanceList: PocPerformance[] = isAdmin 
    ? (performanceData?.performance as PocPerformance[] || [])
    : performanceData?.performance ? [performanceData.performance as PocPerformance] : [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen" data-testid="loading-performance">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">
            {isAdmin ? "POC Performance Dashboard" : "My Performance"}
          </h1>
          <p className="text-muted-foreground">
            {isAdmin 
              ? "Track performance metrics for all POCs including reopen rates and delayed responses"
              : "Track your performance metrics including reopen rate and response times"}
          </p>
        </div>
      </div>

      {performanceList.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No performance data available</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue={performanceList[0]?.poc.id.toString() || "0"} className="space-y-4">
          {isAdmin && performanceList.length > 1 && (
            <TabsList data-testid="tabs-poc-selector">
              {performanceList.map((perf) => (
                <TabsTrigger 
                  key={perf.poc.id} 
                  value={perf.poc.id.toString()}
                  data-testid={`tab-poc-${perf.poc.id}`}
                >
                  {perf.poc.name}
                </TabsTrigger>
              ))}
            </TabsList>
          )}

          {performanceList.map((perf) => (
            <TabsContent key={perf.poc.id} value={perf.poc.id.toString()} className="space-y-6">
              {/* POC Info Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <UserAvatar name={perf.poc.name} size="md" />
                    <div>
                      <div>{perf.poc.name}</div>
                      <div className="text-sm font-normal text-muted-foreground">{perf.poc.email}</div>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Employee ID</p>
                      <p className="text-lg font-semibold" data-testid={`text-employee-id-${perf.poc.id}`}>
                        {perf.poc.employeeId}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Assigned</p>
                      <p className="text-lg font-semibold" data-testid={`text-total-assigned-${perf.poc.id}`}>
                        {perf.metrics.totalAssigned}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Resolved</p>
                      <p className="text-lg font-semibold" data-testid={`text-total-resolved-${perf.poc.id}`}>
                        {perf.metrics.totalResolved}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Resolution Rate</p>
                      <p className="text-lg font-semibold" data-testid={`text-resolution-rate-${perf.poc.id}`}>
                        {perf.metrics.totalAssigned > 0 
                          ? ((perf.metrics.totalResolved / perf.metrics.totalAssigned) * 100).toFixed(1) + "%"
                          : "0%"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Metrics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Reopen Rate</CardTitle>
                    <RefreshCcw className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-baseline gap-2">
                      <div className="text-2xl font-bold" data-testid={`text-reopen-rate-${perf.poc.id}`}>
                        {perf.metrics.reopenRate}%
                      </div>
                      {parseFloat(perf.metrics.reopenRate) > 15 ? (
                        <TrendingUp className="h-4 w-4 text-destructive" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-green-600" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {perf.metrics.totalReopened} out of {perf.metrics.totalResolved} reopened
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Delayed Rate</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-baseline gap-2">
                      <div className="text-2xl font-bold" data-testid={`text-delayed-rate-${perf.poc.id}`}>
                        {perf.metrics.delayedRate}%
                      </div>
                      {parseFloat(perf.metrics.delayedRate) > 20 ? (
                        <TrendingUp className="h-4 w-4 text-destructive" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-green-600" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {perf.metrics.totalDelayed} delayed or overdue
                    </p>
                    <p className="text-xs text-muted-foreground">
                      out of {perf.metrics.totalAssigned} assigned
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">TAT Extensions</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid={`text-tat-extensions-${perf.poc.id}`}>
                      {perf.metrics.totalTatExtensions}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Extension requests made
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Performance Score</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid={`text-performance-score-${perf.poc.id}`}>
                      {(() => {
                        const reopenPenalty = parseFloat(perf.metrics.reopenRate) * 0.5;
                        const delayPenalty = parseFloat(perf.metrics.delayedRate) * 0.3;
                        const score = Math.max(0, 100 - reopenPenalty - delayPenalty);
                        return score.toFixed(0);
                      })()}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Out of 100
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Reopen History */}
              {perf.reopenHistory.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Reopen History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead data-testid="header-gap">Gap</TableHead>
                          <TableHead data-testid="header-reopen-count">Reopen Count</TableHead>
                          <TableHead data-testid="header-reopen-dates">Reopen Dates</TableHead>
                          <TableHead data-testid="header-resolutions">Resolutions Given</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {perf.reopenHistory.map((item, idx) => (
                          <TableRow key={idx} data-testid={`row-reopen-${idx}`}>
                            <TableCell data-testid={`cell-gap-${idx}`}>
                              <div>
                                <div className="font-medium">{item.gapId}</div>
                                <div className="text-sm text-muted-foreground line-clamp-1">
                                  {item.gapTitle}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell data-testid={`cell-count-${idx}`}>
                              <Badge variant={item.reopenCount > 2 ? "destructive" : "secondary"}>
                                {item.reopenCount}x
                              </Badge>
                            </TableCell>
                            <TableCell data-testid={`cell-dates-${idx}`}>
                              <div className="space-y-1">
                                {item.reopenDates.map((date, i) => (
                                  <div key={i} className="text-sm">
                                    {format(new Date(date), "MMM dd, yyyy")}
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell data-testid={`cell-resolutions-${idx}`}>
                              <div className="space-y-2">
                                {item.resolutions.map((res, i) => (
                                  <div key={i} className="text-sm">
                                    <div className="text-xs text-muted-foreground">
                                      {format(new Date(res.resolvedAt), "MMM dd, yyyy")}
                                    </div>
                                    <div className="line-clamp-2">{res.resolution}</div>
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
