import { useState } from "react";
import MetricCard from "@/components/MetricCard";
import GapCard from "@/components/GapCard";
import AISuggestionPanel from "@/components/AISuggestionPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FileText, AlertCircle, CheckCircle, Clock, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import UserAvatar from "@/components/UserAvatar";
import { Input } from "@/components/ui/input";

export default function ManagementDashboard() {
  const [selectedGap, setSelectedGap] = useState<string | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  const mockGaps = [
    {
      id: "GAP-1234",
      title: "Refund process missing customer notification",
      description: "When processing refunds, customers are not receiving email confirmations.",
      status: "NeedsReview" as const,
      priority: "High" as const,
      reporter: "Sarah Chen",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
    },
    {
      id: "GAP-1235",
      title: "Onboarding checklist incomplete for enterprise customers",
      description: "Enterprise customers skip critical security training steps.",
      status: "NeedsReview" as const,
      priority: "Medium" as const,
      reporter: "James Wilson",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
    },
  ];

  const handleAssignGap = () => {
    console.log("Gap assigned");
    setAssignDialogOpen(false);
  };

  return (
    <div className="space-y-6" data-testid="page-management-dashboard">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Management Dashboard</h1>
        <p className="text-sm text-muted-foreground">Review and assign process gaps</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard title="Total Gaps" value={156} icon={FileText} trend={{ value: 12, isPositive: true }} />
        <MetricCard title="Pending Review" value={23} icon={AlertCircle} />
        <MetricCard title="Overdue" value={7} icon={Clock} subtitle="Requires attention" />
        <MetricCard title="Resolved This Week" value={45} icon={CheckCircle} trend={{ value: 8, isPositive: true }} />
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
              {mockGaps.map((gap) => (
                <div key={gap.id} className="space-y-4">
                  <GapCard {...gap} onClick={() => setSelectedGap(gap.id)} />
                  {selectedGap === gap.id && (
                    <div className="grid grid-cols-12 gap-4 ml-4">
                      <div className="col-span-8">
                        <AISuggestionPanel
                          similarGaps={[
                            { id: "GAP-1145", title: "Refund process automation missing", similarity: 87 },
                            { id: "GAP-0892", title: "Customer notification gaps", similarity: 78 },
                          ]}
                          suggestedSOP={{
                            id: "SOP-21",
                            title: "Standard Refund Processing Procedure",
                            confidence: 92,
                            link: "#",
                          }}
                          onApplySOP={() => console.log("Apply SOP")}
                          onViewGap={(id) => console.log("View gap:", id)}
                        />
                      </div>
                      <div className="col-span-4 space-y-2">
                        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
                          <DialogTrigger asChild>
                            <Button className="w-full" data-testid="button-assign-gap">
                              <Users className="h-4 w-4 mr-2" />
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
                                <Select>
                                  <SelectTrigger data-testid="select-poc">
                                    <SelectValue placeholder="Select POC" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="mike">Mike Torres</SelectItem>
                                    <SelectItem value="lisa">Lisa Park</SelectItem>
                                    <SelectItem value="david">David Kim</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label>Priority</Label>
                                <Select defaultValue="High">
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
                                <Input type="date" data-testid="input-tat-deadline" />
                              </div>
                              <Button onClick={handleAssignGap} className="w-full" data-testid="button-confirm-assign">
                                Assign Gap
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button variant="outline" className="w-full" data-testid="button-mark-duplicate">
                          Mark as Duplicate
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
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
