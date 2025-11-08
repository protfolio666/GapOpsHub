import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { gapApi, dashboardApi, userApi } from "@/lib/api";
import MetricCard from "@/components/MetricCard";
import GapCard from "@/components/GapCard";
import AISuggestionPanel from "@/components/AISuggestionPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FileText, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

export default function ManagementDashboard() {
  const [selectedGap, setSelectedGap] = useState<number | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [selectedOriginalGapId, setSelectedOriginalGapId] = useState<string>("");
  const [assignData, setAssignData] = useState({
    assignedToId: "",
    priority: "High",
    tatDeadline: "",
  });

  const { toast } = useToast();

  const { data: metricsData } = useQuery({
    queryKey: ["/api/dashboard/metrics"],
    queryFn: () => dashboardApi.getMetrics(),
  });

  const { data: newGapsData } = useQuery({
    queryKey: ["/api/gaps", { status: "NeedsReview" }],
    queryFn: () => gapApi.getAll({ status: "NeedsReview" }),
  });

  const { data: pocsData } = useQuery({
    queryKey: ["/api/users/role/POC"],
    queryFn: () => userApi.getByRole("POC"),
  });

  const { data: similarGapsData } = useQuery({
    queryKey: ["/api/gaps", selectedGap, "similar"],
    queryFn: () => selectedGap ? gapApi.getSimilar(selectedGap) : Promise.resolve({ similarGaps: [] }),
    enabled: !!selectedGap,
  });

  const assignGapMutation = useMutation({
    mutationFn: (data: { gapId: number; assignedToId: number; tatDeadline: string }) =>
      gapApi.assign(data.gapId, {
        assignedToId: data.assignedToId,
        tatDeadline: data.tatDeadline,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gaps"] });
      setAssignDialogOpen(false);
      setSelectedGap(null);
      toast({
        title: "Gap Assigned",
        description: "The gap has been successfully assigned.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Assignment Failed",
        description: "Unable to assign the gap. Please try again.",
      });
    },
  });

  const markAsDuplicateMutation = useMutation({
    mutationFn: (data: { gapId: number; duplicateOfId: number }) =>
      gapApi.markAsDuplicate(data.gapId, data.duplicateOfId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gaps"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      setDuplicateDialogOpen(false);
      setSelectedGap(null);
      setSelectedOriginalGapId("");
      toast({
        title: "Gap Marked as Duplicate",
        description: "The gap has been marked as a duplicate and closed.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Failed to Mark as Duplicate",
        description: "Unable to mark the gap as duplicate. Please try again.",
      });
    },
  });

  const handleAssignGap = () => {
    if (selectedGap && assignData.assignedToId && assignData.tatDeadline) {
      assignGapMutation.mutate({
        gapId: selectedGap,
        assignedToId: Number(assignData.assignedToId),
        tatDeadline: assignData.tatDeadline,
      });
    }
  };

  const handleMarkAsDuplicate = () => {
    if (selectedGap && selectedOriginalGapId) {
      markAsDuplicateMutation.mutate({
        gapId: selectedGap,
        duplicateOfId: Number(selectedOriginalGapId),
      });
    }
  };

  const metrics = metricsData?.metrics || {};
  const newGaps = newGapsData?.gaps || [];
  const pocs = pocsData?.users || [];
  const similarGaps = similarGapsData?.similarGaps || [];

  return (
    <div className="space-y-6" data-testid="page-management-dashboard">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Management Dashboard</h1>
        <p className="text-sm text-muted-foreground">Review and assign process gaps</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard title="Total Gaps" value={metrics.totalGaps || 0} icon={FileText} />
        <MetricCard title="Pending Review" value={metrics.pendingReview || 0} icon={AlertCircle} />
        <MetricCard title="Overdue" value={metrics.overdue || 0} icon={Clock} subtitle="Requires attention" />
        <MetricCard title="Resolved This Week" value={metrics.resolvedThisWeek || 0} icon={CheckCircle} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gap Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="new" data-testid="tabs-gap-queue">
            <TabsList>
              <TabsTrigger value="new" data-testid="tab-new-submissions">New Submissions</TabsTrigger>
              <TabsTrigger value="flagged" data-testid="tab-ai-flagged">AI Flagged</TabsTrigger>
              <TabsTrigger value="extensions" data-testid="tab-extensions">Extension Requests</TabsTrigger>
            </TabsList>
            <TabsContent value="new" className="space-y-4 mt-4">
              {newGaps.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No new submissions at this time</p>
              ) : (
                newGaps.map((gap) => (
                  <div key={gap.id} className="space-y-4">
                    <GapCard
                      id={gap.gapId}
                      title={gap.title}
                      description={gap.description}
                      status={gap.status as any}
                      priority={gap.priority as any}
                      reporter="QA Team"
                      createdAt={new Date(gap.createdAt)}
                      onClick={() => setSelectedGap(selectedGap === gap.id ? null : gap.id)}
                    />
                    {selectedGap === gap.id && (
                      <div className="grid grid-cols-12 gap-4 ml-4">
                        <div className="col-span-8">
                          <AISuggestionPanel
                            similarGaps={similarGaps.map(sg => ({
                              id: sg.gap?.gapId || "",
                              title: sg.gap?.title || "",
                              similarity: sg.similarityScore,
                            }))}
                            onViewGap={(id) => console.log("View gap:", id)}
                          />
                        </div>
                        <div className="col-span-4 space-y-2">
                          <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
                            <DialogTrigger asChild>
                              <Button className="w-full" data-testid="button-assign-gap">
                                Assign to POC
                              </Button>
                            </DialogTrigger>
                            <DialogContent data-testid="dialog-assign-gap">
                              <DialogHeader>
                                <DialogTitle>Assign Gap to POC</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label>POC</Label>
                                  <Select
                                    value={assignData.assignedToId}
                                    onValueChange={(value) =>
                                      setAssignData({ ...assignData, assignedToId: value })
                                    }
                                  >
                                    <SelectTrigger data-testid="select-poc">
                                      <SelectValue placeholder="Select POC" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {pocs.map((poc) => (
                                        <SelectItem key={poc.id} value={poc.id.toString()}>
                                          {poc.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label>Priority</Label>
                                  <Select
                                    value={assignData.priority}
                                    onValueChange={(value) =>
                                      setAssignData({ ...assignData, priority: value })
                                    }
                                  >
                                    <SelectTrigger data-testid="select-priority">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="High">High</SelectItem>
                                      <SelectItem value="Medium">Medium</SelectItem>
                                      <SelectItem value="Low">Low</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label>TAT Deadline</Label>
                                  <Input
                                    type="date"
                                    value={assignData.tatDeadline}
                                    onChange={(e) =>
                                      setAssignData({ ...assignData, tatDeadline: e.target.value })
                                    }
                                    data-testid="input-tat-deadline"
                                  />
                                </div>
                                <Button
                                  onClick={handleAssignGap}
                                  className="w-full"
                                  disabled={assignGapMutation.isPending}
                                  data-testid="button-confirm-assign"
                                >
                                  {assignGapMutation.isPending ? "Assigning..." : "Assign Gap"}
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                          <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
                            <DialogTrigger asChild>
                              <Button variant="outline" className="w-full" data-testid="button-mark-duplicate">
                                Mark as Duplicate
                              </Button>
                            </DialogTrigger>
                            <DialogContent data-testid="dialog-mark-duplicate">
                              <DialogHeader>
                                <DialogTitle>Mark as Duplicate</DialogTitle>
                                <DialogDescription>
                                  Select the original gap that this submission duplicates. The duplicate gap will be closed and linked to the original.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label>Select Original Gap</Label>
                                  <Select value={selectedOriginalGapId} onValueChange={setSelectedOriginalGapId}>
                                    <SelectTrigger data-testid="select-original-gap">
                                      <SelectValue placeholder="Choose original gap" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {similarGaps.map((sg) => (
                                        <SelectItem key={sg.gap?.id} value={sg.gap?.id?.toString() || ""}>
                                          {sg.gap?.gapId} - {sg.gap?.title} ({Math.round(sg.similarityScore * 100)}% similar)
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  {similarGaps.length === 0 && (
                                    <p className="text-sm text-muted-foreground mt-2">
                                      No similar gaps found. You can still mark as duplicate by entering a gap ID manually.
                                    </p>
                                  )}
                                </div>
                                <DialogFooter>
                                  <Button
                                    variant="outline"
                                    onClick={() => setDuplicateDialogOpen(false)}
                                    data-testid="button-cancel-duplicate"
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    onClick={handleMarkAsDuplicate}
                                    disabled={!selectedOriginalGapId || markAsDuplicateMutation.isPending}
                                    data-testid="button-confirm-duplicate"
                                  >
                                    {markAsDuplicateMutation.isPending ? "Marking..." : "Mark as Duplicate"}
                                  </Button>
                                </DialogFooter>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </TabsContent>
            <TabsContent value="flagged">
              <p className="text-sm text-muted-foreground text-center py-8">No AI-flagged gaps at this time</p>
            </TabsContent>
            <TabsContent value="extensions">
              <p className="text-sm text-muted-foreground text-center py-8">No extension requests pending</p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
