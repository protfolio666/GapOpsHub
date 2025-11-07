import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/StatusBadge";
import PriorityIndicator from "@/components/PriorityIndicator";
import UserAvatar from "@/components/UserAvatar";
import AISuggestionPanel from "@/components/AISuggestionPanel";
import CommentThread from "@/components/CommentThread";
import TimelineView from "@/components/TimelineView";
import { ArrowLeft, CheckCircle, Clock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export default function GapDetailPage() {
  const gapData = {
    id: "GAP-1234",
    title: "Refund process missing customer notification",
    description: "When processing refunds through the admin portal, customers are not receiving email confirmations about the refund status. This has led to an increase in support tickets (approximately 15% of all refund requests) with customers asking whether their refund was processed. The gap was identified during the Q4 refund audit.",
    status: "InProgress" as const,
    priority: "High" as const,
    severity: "Critical",
    reporter: "Sarah Chen",
    assignedTo: "Mike Torres",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72),
    tatDeadline: new Date(Date.now() + 1000 * 60 * 60 * 24),
    department: "Customer Success",
  };

  const mockComments = [
    {
      id: "1",
      author: "Sarah Chen",
      content: "I've identified this gap during the Q4 refund audit. Affecting approximately 15% of all refund requests.",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
    },
    {
      id: "2",
      author: "Mike Torres",
      content: "Investigating now. Found the root cause - email notification service wasn't triggered in the refund workflow. Will implement fix by EOD.",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
      attachments: ["refund_flow_diagram.pdf"],
    },
  ];

  const timelineEvents = [
    { title: "Gap Created", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 72), completed: true },
    { title: "AI Review Completed", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 71), completed: true },
    { title: "Assigned to POC", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48), completed: true },
    { title: "In Progress", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), completed: true },
    { title: "Resolved", timestamp: new Date(), completed: false },
  ];

  return (
    <div className="space-y-6" data-testid="page-gap-detail">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" data-testid="button-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-sm font-medium text-muted-foreground">{gapData.id}</span>
            <StatusBadge status={gapData.status} />
            <PriorityIndicator priority={gapData.priority} showLabel />
          </div>
          <h1 className="text-xl font-semibold">{gapData.title}</h1>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-8 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{gapData.description}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Discussion</CardTitle>
            </CardHeader>
            <CardContent>
              <CommentThread
                comments={mockComments}
                onAddComment={(content) => console.log("New comment:", content)}
              />
            </CardContent>
          </Card>
        </div>

        <div className="col-span-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Reporter</p>
                <div className="flex items-center gap-2">
                  <UserAvatar name={gapData.reporter} size="sm" />
                  <span className="text-sm">{gapData.reporter}</span>
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Assigned To</p>
                <div className="flex items-center gap-2">
                  <UserAvatar name={gapData.assignedTo} size="sm" />
                  <span className="text-sm">{gapData.assignedTo}</span>
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Department</p>
                <Badge variant="secondary">{gapData.department}</Badge>
              </div>
              <Separator />
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase mb-1">TAT Deadline</p>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4" />
                  <span>24 hours remaining</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <AISuggestionPanel
            similarGaps={[
              { id: "GAP-1145", title: "Refund process automation missing", similarity: 87 },
              { id: "GAP-0892", title: "Customer notification gaps", similarity: 78 },
            ]}
            suggestedSOPs={[
              {
                sopId: 21,
                title: "Standard Refund Processing Procedure",
                relevanceScore: 92,
                reasoning: "This SOP directly addresses refund notification procedures and customer communication protocols.",
              },
            ]}
            onApplySOP={(sopId) => console.log("Apply SOP:", sopId)}
            onViewGap={(id) => console.log("View gap:", id)}
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
