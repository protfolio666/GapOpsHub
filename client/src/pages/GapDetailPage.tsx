import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/StatusBadge";
import PriorityIndicator from "@/components/PriorityIndicator";
import UserAvatar from "@/components/UserAvatar";
import AISuggestionPanel from "@/components/AISuggestionPanel";
import CommentThread from "@/components/CommentThread";
import TimelineView from "@/components/TimelineView";
import { ArrowLeft, CheckCircle, Clock, XCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import type { Gap } from "@shared/schema";

interface GapWithRelations extends Gap {
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

export default function GapDetailPage() {
  const [, params] = useRoute("/*/gaps/:id");
  const [, navigate] = useLocation();
  const gapId = params?.id;

  const { data: gapData, isLoading } = useQuery<{ gap: GapWithRelations; reporter: any; assignee: any }>({
    queryKey: [`/api/gaps/${gapId}`],
    enabled: !!gapId,
  });

  const { data: similarGapsData } = useQuery<{ similarGaps: Array<{ gap: GapWithRelations; similarityScore: number }> }>({
    queryKey: [`/api/gaps/${gapId}/similar`],
    enabled: !!gapId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const gap = gapData?.gap;
  const reporter = gapData?.reporter;
  const assignee = gapData?.assignee;

  if (!gap) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-muted-foreground mb-4">Gap not found</p>
        <Button onClick={() => navigate("/admin/gaps")}>Go back to gaps</Button>
      </div>
    );
  }

  const similarGaps = (similarGapsData?.similarGaps || []).map(sg => ({
    id: sg.gap.gapId,
    title: sg.gap.title,
    similarity: Math.round(sg.similarityScore),
  }));

  const sopSuggestions = Array.isArray(gap.sopSuggestions) ? gap.sopSuggestions as Array<{
    sopId: number;
    title: string;
    relevanceScore: number;
    reasoning: string;
  }> : [];

  // Build timeline events from gap data
  const timelineEvents = [
    { title: "Gap Created", timestamp: new Date(gap.createdAt), completed: true },
    gap.aiProcessed && { title: "AI Review Completed", timestamp: new Date(gap.updatedAt), completed: true },
    gap.assignedToId && { title: "Assigned to POC", timestamp: new Date(gap.updatedAt), completed: true },
    gap.status === "InProgress" && { title: "In Progress", timestamp: new Date(gap.updatedAt), completed: true },
    gap.resolvedAt && { title: "Resolved", timestamp: new Date(gap.resolvedAt), completed: true },
    gap.closedAt && { title: "Closed", timestamp: new Date(gap.closedAt), completed: true },
  ].filter(Boolean) as Array<{ title: string; timestamp: Date; completed: boolean }>;

  return (
    <div className="space-y-6" data-testid="page-gap-detail">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()} data-testid="button-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-sm font-medium text-muted-foreground">{gap.gapId}</span>
            <StatusBadge status={gap.status as any} />
            <PriorityIndicator priority={gap.priority as any} showLabel />
          </div>
          <h1 className="text-xl font-semibold">{gap.title}</h1>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-8 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{gap.description}</p>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {reporter && (
                <>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Reporter</p>
                    <div className="flex items-center gap-2">
                      <UserAvatar name={reporter.name} size="sm" />
                      <span className="text-sm">{reporter.name}</span>
                    </div>
                  </div>
                  <Separator />
                </>
              )}
              {assignee && (
                <>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Assigned To</p>
                    <div className="flex items-center gap-2">
                      <UserAvatar name={assignee.name} size="sm" />
                      <span className="text-sm">{assignee.name}</span>
                    </div>
                  </div>
                  <Separator />
                </>
              )}
              {gap.department && (
                <>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Department</p>
                    <Badge variant="secondary">{gap.department}</Badge>
                  </div>
                  <Separator />
                </>
              )}
              {gap.tatDeadline && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase mb-1">TAT Deadline</p>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4" />
                    <span>{new Date(gap.tatDeadline).toLocaleDateString()}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <AISuggestionPanel
            similarGaps={similarGaps}
            suggestedSOPs={sopSuggestions}
            onApplySOP={(sopId) => console.log("Apply SOP:", sopId)}
            onViewGap={(gapId) => navigate(`/*/gaps/${gapId}`)}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <TimelineView events={timelineEvents} />
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button className="w-full" data-testid="button-resolve-gap">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark as Resolved
                </Button>
              </DialogTrigger>
              <DialogContent data-testid="dialog-resolve-gap">
                <DialogHeader>
                  <DialogTitle>Mark Gap as Resolved</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Resolution Summary</Label>
                    <Textarea placeholder="Describe how the gap was resolved..." rows={4} data-testid="input-resolution-summary" />
                  </div>
                  <Button className="w-full" data-testid="button-confirm-resolve">
                    Confirm Resolution
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full" data-testid="button-request-extension">
                  <Clock className="h-4 w-4 mr-2" />
                  Request Extension
                </Button>
              </DialogTrigger>
              <DialogContent data-testid="dialog-request-extension">
                <DialogHeader>
                  <DialogTitle>Request TAT Extension</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Reason</Label>
                    <Textarea placeholder="Explain why you need more time..." rows={3} data-testid="input-extension-reason" />
                  </div>
                  <div>
                    <Label>Requested Deadline</Label>
                    <Input type="date" data-testid="input-extension-date" />
                  </div>
                  <Button className="w-full" data-testid="button-submit-extension">
                    Submit Request
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="outline" className="w-full" data-testid="button-reopen-gap">
              <XCircle className="h-4 w-4 mr-2" />
              Reopen Gap
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
