import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertTriangle, TrendingUp } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { format } from "date-fns";
import type { RecurringGapPattern } from "@shared/schema";

export default function RecurringGapsPage() {
  const [, setLocation] = useLocation();
  const [showSystemicOnly, setShowSystemicOnly] = useState(false);

  const { data: patternsData, isLoading } = useQuery<{ patterns: RecurringGapPattern[] }>({
    queryKey: ["/api/recurring-gaps"]
  });

  const { data: systemicData } = useQuery<{ patterns: RecurringGapPattern[] }>({
    queryKey: ["/api/recurring-gaps/systemic"],
    enabled: showSystemicOnly
  });

  const patterns = showSystemicOnly ? systemicData?.patterns : patternsData?.patterns;

  const getSeverityBadgeVariant = (severity?: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (severity) {
      case "critical": return "destructive";
      case "high": return "destructive";
      case "medium": return "secondary";
      case "low": return "default";
      default: return "outline";
    }
  };

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/")}
          data-testid="button-back-recurring"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2" data-testid="text-recurring-title">
            <TrendingUp className="w-8 h-8" />
            Recurring Gap Patterns
          </h1>
          <p className="text-muted-foreground mt-1">Track systemic issues and process gaps</p>
        </div>
        <Button
          variant={showSystemicOnly ? "default" : "outline"}
          onClick={() => setShowSystemicOnly(!showSystemicOnly)}
          data-testid="button-filter-systemic"
        >
          <AlertTriangle className="w-4 h-4 mr-2" />
          {showSystemicOnly ? "All Patterns" : "Systemic Only"}
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Loading patterns...
          </CardContent>
        </Card>
      ) : !patterns || patterns.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            {showSystemicOnly ? "No systemic issues flagged yet" : "No recurring gap patterns found"}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {patterns.map((pattern) => (
            <Card key={pattern.id} className="hover-elevate">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {pattern.commonTitle}
                      {pattern.isFlaggedAsSystemic && (
                        <Badge variant={getSeverityBadgeVariant(pattern.systemicSeverity)}>
                          {pattern.systemicSeverity}
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {pattern.department && `Department: ${pattern.department}`}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold" data-testid={`text-occurrence-count-${pattern.id}`}>
                      {pattern.occurrenceCount}
                    </div>
                    <div className="text-xs text-muted-foreground">occurrences</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">First Occurrence</p>
                    <p className="font-medium">{format(new Date(pattern.firstOccurrenceAt), "MMM dd, yyyy")}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Latest Occurrence</p>
                    <p className="font-medium">{format(new Date(pattern.lastOccurrenceAt), "MMM dd, yyyy")}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Resolved</p>
                    <p className="font-medium">{pattern.resolvedCount} gaps</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Open Rate</p>
                    <p className="font-medium">
                      {pattern.occurrenceCount > 0 
                        ? (((pattern.occurrenceCount - pattern.resolvedCount) / pattern.occurrenceCount) * 100).toFixed(0)
                        : 0}%
                    </p>
                  </div>
                </div>

                {pattern.suggestedAction && (
                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-md p-3">
                    <p className="text-xs font-semibold text-amber-900 dark:text-amber-200 uppercase tracking-wide mb-1">
                      Suggested Action
                    </p>
                    <p className="text-sm text-amber-800 dark:text-amber-100">{pattern.suggestedAction}</p>
                  </div>
                )}

                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                    Related Gaps ({pattern.gapIds?.length || 0})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {pattern.gapIds && pattern.gapIds.length > 0 ? (
                      pattern.gapIds.slice(0, 5).map((gapId: any, idx: number) => (
                        <Badge key={idx} variant="outline" data-testid={`badge-gap-${gapId}`}>
                          Gap #{gapId}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">No related gaps</span>
                    )}
                    {pattern.gapIds && pattern.gapIds.length > 5 && (
                      <Badge variant="outline">+{pattern.gapIds.length - 5} more</Badge>
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
