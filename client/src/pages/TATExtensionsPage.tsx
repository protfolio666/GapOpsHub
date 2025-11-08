import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Gap, User } from "@shared/schema";

interface TatExtension {
  id: number;
  gapId: number;
  requestedById: number;
  reason: string;
  requestedDeadline: string;
  status: string;
  reviewedById?: number;
  reviewedAt?: string;
  createdAt: string;
  gap: Gap;
  requester: User;
  reviewer?: User;
}

export default function TATExtensionsPage() {
  const { toast } = useToast();

  const { data: extensionsData, isLoading } = useQuery<{ extensions: TatExtension[] }>({
    queryKey: ["/api/tat-extensions/pending"],
  });

  const extensions = extensionsData?.extensions || [];

  const approveMutation = useMutation({
    mutationFn: async (extensionId: number) => {
      return await apiRequest("PATCH", `/api/tat-extensions/${extensionId}`, {
        status: "Approved",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tat-extensions/pending"] });
      toast({
        title: "Success",
        description: "TAT extension has been approved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to approve extension.",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (extensionId: number) => {
      return await apiRequest("PATCH", `/api/tat-extensions/${extensionId}`, {
        status: "Rejected",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tat-extensions/pending"] });
      toast({
        title: "Success",
        description: "TAT extension has been rejected.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to reject extension.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen" data-testid="loading-extensions">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">TAT Extension Requests</h1>
          <p className="text-muted-foreground">Review and approve TAT extension requests from POCs</p>
        </div>
        <Badge variant="secondary" data-testid="badge-pending-count">
          {extensions.length} Pending
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {extensions.length === 0 ? (
            <div className="text-center py-12" data-testid="text-no-requests">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No pending TAT extension requests</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead data-testid="header-gap">Gap</TableHead>
                  <TableHead data-testid="header-requester">Requested By</TableHead>
                  <TableHead data-testid="header-reason">Reason</TableHead>
                  <TableHead data-testid="header-current-deadline">Current Deadline</TableHead>
                  <TableHead data-testid="header-requested-deadline">Requested Deadline</TableHead>
                  <TableHead data-testid="header-requested-date">Requested On</TableHead>
                  <TableHead data-testid="header-actions">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {extensions.map((ext) => (
                  <TableRow key={ext.id} data-testid={`row-extension-${ext.id}`}>
                    <TableCell data-testid={`cell-gap-${ext.id}`}>
                      <div>
                        <div className="font-medium">{ext.gap.gapId}</div>
                        <div className="text-sm text-muted-foreground line-clamp-1">
                          {ext.gap.title}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell data-testid={`cell-requester-${ext.id}`}>
                      <div>
                        <div className="font-medium">{ext.requester.name}</div>
                        <div className="text-sm text-muted-foreground">{ext.requester.email}</div>
                      </div>
                    </TableCell>
                    <TableCell data-testid={`cell-reason-${ext.id}`}>
                      <div className="max-w-xs">
                        <p className="text-sm line-clamp-2">{ext.reason}</p>
                      </div>
                    </TableCell>
                    <TableCell data-testid={`cell-current-deadline-${ext.id}`}>
                      {ext.gap.tatDeadline
                        ? format(new Date(ext.gap.tatDeadline), "MMM dd, yyyy")
                        : "N/A"}
                    </TableCell>
                    <TableCell data-testid={`cell-requested-deadline-${ext.id}`}>
                      {format(new Date(ext.requestedDeadline), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell data-testid={`cell-created-${ext.id}`}>
                      {format(new Date(ext.createdAt), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell data-testid={`cell-actions-${ext.id}`}>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => approveMutation.mutate(ext.id)}
                          disabled={approveMutation.isPending || rejectMutation.isPending}
                          data-testid={`button-approve-${ext.id}`}
                        >
                          {approveMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => rejectMutation.mutate(ext.id)}
                          disabled={approveMutation.isPending || rejectMutation.isPending}
                          data-testid={`button-reject-${ext.id}`}
                        >
                          {rejectMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </>
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
