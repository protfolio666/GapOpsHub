import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/StatusBadge";
import PriorityIndicator from "@/components/PriorityIndicator";
import UserAvatar from "@/components/UserAvatar";
import AISuggestionPanel from "@/components/AISuggestionPanel";
import CommentThread from "@/components/CommentThread";
import TimelineView from "@/components/TimelineView";
import { ArrowLeft, CheckCircle, Clock, XCircle, Loader2, FileText, Paperclip, X, Upload, UserPlus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Gap, Comment } from "@shared/schema";

interface GapPoc {
  id: number;
  gapId: number;
  userId: number;
  addedById: number;
  addedAt: string;
  isPrimary: boolean;
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
  addedBy: {
    id: number;
    name: string;
  };
}

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

interface CommentWithAuthor extends Comment {
  author: {
    id: number;
    name: string;
    email: string;
    role: string;
  } | null;
}

export default function GapDetailPage() {
  const [, params] = useRoute("/*/gaps/:id");
  const [, navigate] = useLocation();
  const gapId = params?.id;
  const { toast } = useToast();
  const [socket, setSocket] = useState<Socket | null>(null);
  
  // Helper function to check if current user is any POC on this gap (primary or secondary)
  const isAnyPocOnGap = (userId: number | undefined, gap: GapWithRelations | undefined, pocs: GapPoc[] | undefined) => {
    if (!userId || !gap || !pocs) return false;
    // Check if user is primary assignee OR in the POC list
    return gap.assignedToId === userId || pocs.some(poc => poc.userId === userId);
  };
  const [resolutionSummary, setResolutionSummary] = useState("");
  const [resolutionFiles, setResolutionFiles] = useState<File[]>([]);
  const [isResolveDialogOpen, setIsResolveDialogOpen] = useState(false);
  const resolutionFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isAddPocDialogOpen, setIsAddPocDialogOpen] = useState(false);
  const [selectedPocId, setSelectedPocId] = useState<string>("");
  const [isExtensionDialogOpen, setIsExtensionDialogOpen] = useState(false);
  const [extensionReason, setExtensionReason] = useState("");
  const [extensionDeadline, setExtensionDeadline] = useState("");

  const { data: userData } = useQuery<{ user: any }>({
    queryKey: ["/api/auth/me"],
  });

  const { data: gapData, isLoading } = useQuery<{ gap: GapWithRelations; reporter: any; assignee: any; pocs: GapPoc[] }>({
    queryKey: [`/api/gaps/${gapId}`],
    enabled: !!gapId,
  });

  const { data: similarGapsData } = useQuery<{ similarGaps: Array<{ gap: GapWithRelations; similarityScore: number }> }>({
    queryKey: [`/api/gaps/${gapId}/similar`],
    enabled: !!gapId,
  });

  const { data: commentsData } = useQuery<{ comments: CommentWithAuthor[] }>({
    queryKey: [`/api/gaps/${gapId}/comments`],
    enabled: !!gapId,
  });

  // Fetch comprehensive timeline
  const { data: timelineData } = useQuery<{ timeline: Array<{
    type: string;
    occurredAt: string;
    actorId: number | null;
    actor: any | null;
    metadata: any;
  }> }>({
    queryKey: [`/api/gaps/${gapId}/timeline`],
    enabled: !!gapId,
  });

  // Fetch original gap if this is a duplicate
  const { data: originalGapData } = useQuery<{ gap: GapWithRelations }>({
    queryKey: [`/api/gaps/${gapData?.gap?.duplicateOfId}`],
    enabled: !!gapData?.gap?.duplicateOfId,
  });

  // Fetch audit logs to find who closed this gap as duplicate
  const { data: closerData } = useQuery<{ closer: { name: string; email: string } | null }>({
    queryKey: [`/api/gaps/${gapId}/closer`],
    enabled: !!gapId && !!gapData?.gap?.duplicateOfId,
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({ content, attachments }: { content: string; attachments: any[] }) => {
      return await apiRequest("POST", `/api/gaps/${gapId}/comments`, { content, attachments });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/gaps/${gapId}/comments`] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to post comment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resolveGapMutation = useMutation({
    mutationFn: async () => {
      let uploadedFiles: any[] = [];

      // Upload files first if any
      if (resolutionFiles.length > 0) {
        const formData = new FormData();
        resolutionFiles.forEach((file) => {
          formData.append("files", file);
        });

        const uploadResponse = await fetch("/api/files/upload", {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload files");
        }

        const uploadData = await uploadResponse.json();
        uploadedFiles = uploadData.files;
      }

      // Resolve gap with file metadata
      return await apiRequest("PATCH", `/api/gaps/${gapId}/resolve`, {
        resolutionSummary,
        resolutionAttachments: uploadedFiles.map((f: any) => ({
          originalName: f.originalName,
          filename: f.filename,
          size: f.size,
          mimetype: f.mimetype,
          path: f.path,
        })),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/gaps/${gapId}`] });
      setIsResolveDialogOpen(false);
      setResolutionSummary("");
      setResolutionFiles([]);
      toast({
        title: "Success",
        description: "Gap has been marked as resolved.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to resolve gap. Please try again.",
        variant: "destructive",
      });
    },
  });

  const markInProgressMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("PATCH", `/api/gaps/${gapId}`, { status: "InProgress" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/gaps/${gapId}`] });
      toast({
        title: "Success",
        description: "Gap marked as in progress.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update gap status.",
        variant: "destructive",
      });
    },
  });

  const reopenGapMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/gaps/${gapId}/reopen`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/gaps/${gapId}`] });
      toast({
        title: "Success",
        description: "Gap has been reopened.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reopen gap.",
        variant: "destructive",
      });
    },
  });

  const requestExtensionMutation = useMutation({
    mutationFn: async () => {
      if (!extensionReason.trim() || !extensionDeadline) {
        throw new Error("Please provide both reason and requested deadline");
      }
      return await apiRequest("POST", `/api/gaps/${gapId}/tat-extensions`, {
        reason: extensionReason,
        requestedDeadline: extensionDeadline,
      });
    },
    onSuccess: () => {
      setIsExtensionDialogOpen(false);
      setExtensionReason("");
      setExtensionDeadline("");
      toast({
        title: "Success",
        description: "TAT extension request has been submitted to Management for review.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit extension request.",
        variant: "destructive",
      });
    },
  });

  // Query all POC users for the add POC dialog
  const { data: pocUsersData } = useQuery<{ users: any[] }>({
    queryKey: ["/api/pocs"],
  });

  const addPocMutation = useMutation({
    mutationFn: async (userId: number) => {
      return await apiRequest("POST", `/api/gaps/${gapId}/pocs`, { userId, isPrimary: false });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/gaps/${gapId}`] });
      setIsAddPocDialogOpen(false);
      setSelectedPocId("");
      toast({
        title: "Success",
        description: "POC has been added to this gap.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add POC.",
        variant: "destructive",
      });
    },
  });

  const removePocMutation = useMutation({
    mutationFn: async (userId: number) => {
      return await apiRequest("DELETE", `/api/gaps/${gapId}/pocs/${userId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/gaps/${gapId}`] });
      toast({
        title: "Success",
        description: "POC has been removed from this gap.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove POC.",
        variant: "destructive",
      });
    },
  });

  // Setup WebSocket connection for real-time comments
  useEffect(() => {
    if (!gapId) return;

    const newSocket = io({
      withCredentials: true,
    });
    setSocket(newSocket);

    // Handle connection errors
    newSocket.on("connect_error", (error) => {
      console.error("WebSocket connection error:", error);
      toast({
        title: "Connection Issue",
        description: "Real-time updates unavailable. Your comments will still be saved.",
        variant: "destructive",
      });
    });

    // Join gap-specific room
    newSocket.on("connect", () => {
      newSocket.emit("join-gap", gapId);
    });

    // Listen for new comments
    newSocket.on("new-comment", (comment: CommentWithAuthor) => {
      queryClient.setQueryData<{ comments: CommentWithAuthor[] }>(
        [`/api/gaps/${gapId}/comments`],
        (old) => {
          if (!old) return { comments: [comment] };
          return { comments: [...old.comments, comment] };
        }
      );
    });

    return () => {
      newSocket.emit("leave-gap", gapId);
      newSocket.close();
    };
  }, [gapId]);

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
    id: sg.gap.gapId, // This is the display ID like "GAP-0002"
    numericId: sg.gap.id, // This is the database ID
    title: sg.gap.title,
    similarity: Math.round(sg.similarityScore),
  }));

  const sopSuggestions = Array.isArray(gap.sopSuggestions) ? gap.sopSuggestions as Array<{
    sopId: number;
    title: string;
    relevanceScore: number;
    reasoning: string;
  }> : [];

  // Build timeline events from comprehensive timeline API
  const timelineEvents = (timelineData?.timeline || []).map((event) => {
    let title = "";
    switch (event.type) {
      case "created":
        title = "Gap Created";
        break;
      case "assigned":
        title = `Assigned to ${event.actor?.name || "POC"}`;
        break;
      case "in_progress":
        title = "Work Started";
        break;
      case "resolved":
        title = `Resolved by ${event.actor?.name || "POC"}`;
        break;
      case "reopened":
        title = `Reopened by ${event.actor?.name || "User"}`;
        break;
      case "closed":
        title = "Closed";
        break;
      default:
        title = event.type;
    }
    return {
      title,
      timestamp: new Date(event.occurredAt),
      completed: true,
    };
  });

  // Keep attachments as objects (not strings) so download paths work
  const attachments = Array.isArray(gap.attachments) ? gap.attachments : [];

  const comments = (commentsData?.comments || []).map((c) => ({
    id: String(c.id),
    author: c.author?.name || "Unknown",
    content: c.content,
    createdAt: new Date(c.createdAt),
    // Keep attachments as objects (not strings) so download paths work
    attachments: Array.isArray(c.attachments) ? c.attachments : [],
  }));

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
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="details" data-testid="tab-details">Details</TabsTrigger>
              <TabsTrigger value="attachments" data-testid="tab-attachments">
                Attachments {attachments.length > 0 && `(${attachments.length})`}
              </TabsTrigger>
              <TabsTrigger value="resolutions" data-testid="tab-resolutions">
                Resolutions {(timelineData?.timeline || []).filter(e => e.type === 'resolved').length > 0 && `(${(timelineData?.timeline || []).filter(e => e.type === 'resolved').length})`}
              </TabsTrigger>
              <TabsTrigger value="discussion" data-testid="tab-discussion">
                Discussion {comments.length > 0 && `(${comments.length})`}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="mt-4 space-y-4">
              {gap.duplicateOfId && originalGapData?.gap && (
                <Card className="border-yellow-500 dark:border-yellow-700">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
                      Closed as Duplicate
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">
                        <strong>Reason:</strong> This gap has been identified as a duplicate submission.
                      </p>
                      <div className="bg-muted p-3 rounded-md space-y-2">
                        <p className="text-sm">
                          <strong>Original Gap:</strong> <span className="font-mono">{originalGapData.gap.gapId}</span>
                        </p>
                        <p className="text-sm">
                          <strong>Title:</strong> {originalGapData.gap.title}
                        </p>
                        {closerData?.closer && (
                          <>
                            <Separator className="my-2" />
                            <p className="text-sm">
                              <strong>Closed By:</strong> {closerData.closer.name}
                            </p>
                            <p className="text-sm">
                              <strong>Email for Clarification:</strong>{" "}
                              <a 
                                href={`mailto:${closerData.closer.email}`} 
                                className="text-primary hover:underline"
                                data-testid="link-closer-email"
                              >
                                {closerData.closer.email}
                              </a>
                            </p>
                          </>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (userData?.user) {
                              const role = userData.user.role;
                              if (role === "Admin") {
                                navigate(`/admin/gaps/${originalGapData.gap.id}`);
                              } else if (role === "Management") {
                                navigate(`/management/gaps/${originalGapData.gap.id}`);
                              } else if (role === "POC") {
                                navigate(`/poc/gaps/${originalGapData.gap.id}`);
                              } else {
                                navigate(`/qa/gaps/${originalGapData.gap.id}`);
                              }
                            }
                          }}
                          className="mt-2"
                          data-testid="button-view-original-gap"
                        >
                          View Original Gap
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{gap.description}</p>
                </CardContent>
              </Card>

              {(gap.status === "Resolved" || gap.status === "Closed") && gap.resolutionSummary && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Resolution</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-2">Resolution Summary</h4>
                      <p className="text-sm whitespace-pre-wrap text-muted-foreground">{gap.resolutionSummary}</p>
                    </div>
                    
                    {gap.resolutionAttachments && Array.isArray(gap.resolutionAttachments) && gap.resolutionAttachments.length > 0 ? (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Supporting Documents</h4>
                        <div className="space-y-2">
                          {(gap.resolutionAttachments as any[]).map((file: any, idx: number) => {
                            const isFileObject = typeof file === "object" && file.path;
                            const displayName = isFileObject ? file.originalName : file;
                            let downloadPath = isFileObject ? file.path : null;
                            const isImage = isFileObject && file.mimetype?.startsWith("image/");
                            
                            if (downloadPath && gapId) {
                              downloadPath = `${downloadPath}?gapId=${gapId}`;
                            }
                            
                            return (
                              <div key={idx} className="flex items-center gap-2 p-3 bg-muted rounded-md hover-elevate" data-testid={`resolution-attachment-display-${idx}`}>
                                <FileText className="h-5 w-5 text-muted-foreground" />
                                <span className="text-sm flex-1">{displayName}</span>
                                {downloadPath && (
                                  <a
                                    href={downloadPath}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    download={displayName}
                                  >
                                    <Button variant="ghost" size="sm" data-testid={`button-download-resolution-${idx}`}>
                                      {isImage ? "View" : "Download"}
                                    </Button>
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            <TabsContent value="attachments" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Attachments</CardTitle>
                  {attachments.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        window.open(`/api/gaps/${gapId}/attachments/download`, '_blank');
                      }}
                      data-testid="button-download-all-attachments"
                    >
                      <Paperclip className="h-4 w-4 mr-2" />
                      Download All
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {attachments.length > 0 ? (
                    <div className="space-y-2">
                      {attachments.map((file: any, idx) => {
                        const isFileObject = typeof file === "object" && file.path;
                        const displayName = isFileObject ? file.originalName : file;
                        let downloadPath = isFileObject ? file.path : null;
                        const isImage = isFileObject && file.mimetype?.startsWith("image/");
                        
                        if (downloadPath && gapId) {
                          downloadPath = `${downloadPath}?gapId=${gapId}`;
                        }
                        
                        return (
                          <div key={idx} className="flex items-center gap-2 p-3 bg-muted rounded-md hover-elevate" data-testid={`attachment-${idx}`}>
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <span className="text-sm flex-1">{displayName}</span>
                            {downloadPath && (
                              <a
                                href={downloadPath}
                                target="_blank"
                                rel="noopener noreferrer"
                                download={displayName}
                              >
                                <Button variant="ghost" size="sm" data-testid={`button-download-${idx}`}>
                                  {isImage ? "View" : "Download"}
                                </Button>
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No attachments uploaded</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="resolutions" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Resolution History</CardTitle>
                </CardHeader>
                <CardContent>
                  {(timelineData?.timeline || []).filter(e => e.type === 'resolved').length > 0 ? (
                    <div className="space-y-4">
                      {(timelineData?.timeline || [])
                        .filter(e => e.type === 'resolved')
                        .reverse()
                        .map((event, idx) => (
                          <div key={idx} className="border-b last:border-b-0 pb-4 last:pb-0">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <span className="text-sm font-medium">Resolution #{(timelineData?.timeline || []).filter(e => e.type === 'resolved').length - idx}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(event.occurredAt), "MMM dd, yyyy 'at' h:mm a")}
                              </span>
                            </div>
                            <div className="ml-6 space-y-2">
                              <div>
                                <span className="text-sm text-muted-foreground">Resolved by: </span>
                                <span className="text-sm font-medium">{event.actor?.name || "Unknown"}</span>
                                <span className="text-xs text-muted-foreground ml-2">({event.actor?.role})</span>
                              </div>
                              <div>
                                <p className="text-sm font-medium mb-1">Summary:</p>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                  {event.metadata?.resolutionSummary || "No summary provided"}
                                </p>
                              </div>
                              {event.metadata?.resolutionAttachments && Array.isArray(event.metadata.resolutionAttachments) && event.metadata.resolutionAttachments.length > 0 && (
                                <div>
                                  <p className="text-sm font-medium mb-1">Attachments:</p>
                                  <div className="space-y-1">
                                    {event.metadata.resolutionAttachments.map((file: any, fileIdx: number) => {
                                      const isFileObject = typeof file === "object" && file.path;
                                      const displayName = isFileObject ? file.originalName : file;
                                      let downloadPath = isFileObject ? file.path : null;
                                      if (downloadPath && gapId) {
                                        downloadPath = `${downloadPath}?gapId=${gapId}`;
                                      }
                                      return (
                                        <div key={fileIdx} className="flex items-center gap-2 text-sm">
                                          <FileText className="h-4 w-4 text-muted-foreground" />
                                          <span className="flex-1">{displayName}</span>
                                          {downloadPath && (
                                            <a href={downloadPath} target="_blank" rel="noopener noreferrer" download={displayName}>
                                              <Button variant="ghost" size="sm">Download</Button>
                                            </a>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No resolutions yet</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="discussion" className="mt-4">
              {gap.status === "Closed" || gap.status === "Resolved" ? (
                <>
                  <Card className="mb-4">
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground text-center">
                        <XCircle className="h-5 w-5 inline-block mr-2" />
                        Discussion is closed. This gap has been {gap.status === "Closed" ? "closed" : "resolved"}.
                      </p>
                    </CardContent>
                  </Card>
                  <CommentThread 
                    comments={comments}
                    gapId={Number(gapId)}
                  />
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium">Discussion</h3>
                    {userData?.user && gap.assignedToId && (["Admin", "Management"].includes(userData.user.role) || gap.assignedToId === userData.user.id || gapData.pocs.some(p => p.userId === userData.user.id && p.isPrimary)) && (
                      <Dialog open={isAddPocDialogOpen} onOpenChange={setIsAddPocDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" data-testid="button-add-poc-discussion">
                            <UserPlus className="h-4 w-4 mr-2" />
                            Add Team Member
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add Team Member to Discussion</DialogTitle>
                            <DialogDescription>
                              Select a POC to add to this discussion. They will have full access to view, comment, and contribute to resolving this gap.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div>
                              <Label htmlFor="poc-select-discussion">Select POC</Label>
                              <Select value={selectedPocId} onValueChange={setSelectedPocId}>
                                <SelectTrigger id="poc-select-discussion" data-testid="select-poc-discussion">
                                  <SelectValue placeholder="Choose a team member" />
                                </SelectTrigger>
                                <SelectContent>
                                  {pocUsersData?.users.filter(u => !gapData.pocs.some(p => p.userId === u.id)).map((user) => (
                                    <SelectItem key={user.id} value={String(user.id)}>
                                      {user.name} ({user.employeeId})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button 
                              onClick={() => {
                                if (selectedPocId) {
                                  addPocMutation.mutate(Number(selectedPocId));
                                  setSelectedPocId("");
                                }
                              }}
                              disabled={addPocMutation.isPending || !selectedPocId}
                              data-testid="button-confirm-add-poc-discussion"
                            >
                              {addPocMutation.isPending ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Adding...
                                </>
                              ) : (
                                "Add POC"
                              )}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                  <CommentThread 
                    comments={comments}
                    onAddComment={async (content, attachments) => {
                      await addCommentMutation.mutateAsync({ content, attachments });
                    }}
                    isSubmitting={addCommentMutation.isPending}
                    gapId={Number(gapId)}
                  />
                </>
              )}
            </TabsContent>
          </Tabs>
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
              {(gapData?.pocs && gapData.pocs.length > 0) && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase">Assigned POCs</p>
                      {userData?.user && gap.assignedToId && (["Admin", "Management"].includes(userData.user.role) || gap.assignedToId === userData.user.id || gapData.pocs.some(p => p.userId === userData.user.id && p.isPrimary)) && (
                        <Dialog open={isAddPocDialogOpen} onOpenChange={setIsAddPocDialogOpen}>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" data-testid="button-add-poc">
                              <UserPlus className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Add POC</DialogTitle>
                              <DialogDescription>
                                Select a POC to assign to this gap. The POC will have full access to view, comment, and resolve the gap.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div>
                                <Label htmlFor="poc-select">Select POC</Label>
                                <Select value={selectedPocId} onValueChange={setSelectedPocId}>
                                  <SelectTrigger id="poc-select" data-testid="select-poc">
                                    <SelectValue placeholder="Choose a POC" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {pocUsersData?.users.filter(u => !gapData.pocs.some(p => p.userId === u.id)).map((user) => (
                                      <SelectItem key={user.id} value={String(user.id)}>
                                        {user.name} ({user.employeeId})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <DialogFooter>
                              <Button 
                                onClick={() => {
                                  if (selectedPocId) {
                                    addPocMutation.mutate(Number(selectedPocId));
                                  }
                                }}
                                disabled={!selectedPocId || addPocMutation.isPending}
                                data-testid="button-confirm-add-poc"
                              >
                                {addPocMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Add POC
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                    <div className="space-y-2">
                      {gapData.pocs.map((poc) => (
                        <div key={poc.id} className="flex items-center gap-2">
                          <UserAvatar name={poc.user.name} size="sm" />
                          <span className="text-sm flex-1">{poc.user.name}</span>
                          {poc.isPrimary && <Badge variant="secondary" className="text-xs">Primary</Badge>}
                          {userData?.user && (["Admin", "Management"].includes(userData.user.role) || gapData.pocs.some(p => p.userId === userData.user.id && p.isPrimary)) && !poc.isPrimary && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removePocMutation.mutate(poc.userId)}
                              disabled={removePocMutation.isPending}
                              data-testid={`button-remove-poc-${poc.userId}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ))}
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
            onViewGap={(gapIdStr) => {
              // Find the gap by gapId string to get the numeric ID
              const targetGap = similarGaps.find(sg => sg.id === gapIdStr);
              if (targetGap && userData?.user) {
                // Navigate using the route pattern based on user role
                if (userData.user.role === "Admin") {
                  navigate(`/admin/gaps/${targetGap.numericId}`);
                } else if (userData.user.role === "Management") {
                  navigate(`/management/gaps/${targetGap.numericId}`);
                } else if (userData.user.role === "POC") {
                  navigate(`/poc/gaps/${targetGap.numericId}`);
                } else {
                  navigate(`/qa/gaps/${targetGap.numericId}`);
                }
              }
            }}
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
            {userData?.user && gap?.status === "Assigned" && isAnyPocOnGap(userData.user.id, gap, gapData?.pocs) && (
              <Button 
                className="w-full" 
                variant="default"
                onClick={() => markInProgressMutation.mutate()}
                disabled={markInProgressMutation.isPending}
                data-testid="button-mark-in-progress"
              >
                {markInProgressMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Clock className="h-4 w-4 mr-2" />
                    Mark as In Progress
                  </>
                )}
              </Button>
            )}
            
            {userData?.user && (["Management", "Admin"].includes(userData.user.role) || isAnyPocOnGap(userData.user.id, gap, gapData?.pocs)) && 
             gap && gap.status !== "Resolved" && gap.status !== "Closed" && (
              <Dialog open={isResolveDialogOpen} onOpenChange={setIsResolveDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full" data-testid="button-resolve-gap">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark as Resolved
                  </Button>
                </DialogTrigger>
              <DialogContent data-testid="dialog-resolve-gap" className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Mark Gap as Resolved</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="resolution-summary">Resolution Summary *</Label>
                    <Textarea 
                      id="resolution-summary"
                      placeholder="Describe how the gap was resolved, actions taken, and preventive measures..." 
                      rows={6} 
                      value={resolutionSummary}
                      onChange={(e) => setResolutionSummary(e.target.value)}
                      data-testid="input-resolution-summary" 
                    />
                  </div>
                  <div>
                    <Label>Supporting Documents (Optional)</Label>
                    <Input
                      type="file"
                      onChange={(e) => {
                        const files = e.target.files;
                        if (files) {
                          setResolutionFiles(prev => [...prev, ...Array.from(files)]);
                        }
                      }}
                      multiple
                      className="hidden"
                      ref={resolutionFileInputRef}
                      data-testid="input-resolution-files-hidden"
                    />
                    <Button 
                      variant="outline" 
                      onClick={() => resolutionFileInputRef.current?.click()}
                      className="w-full"
                      type="button"
                      data-testid="button-upload-resolution-docs"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Documents
                    </Button>
                    {resolutionFiles.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {resolutionFiles.map((file, idx) => (
                          <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md" data-testid={`resolution-attachment-${idx}`}>
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{file.name}</span>
                            <button
                              onClick={() => setResolutionFiles(prev => prev.filter((_, i) => i !== idx))}
                              className="hover:bg-muted-foreground/20 rounded-full p-1"
                              data-testid={`button-remove-resolution-attachment-${idx}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button 
                    className="w-full" 
                    onClick={() => resolveGapMutation.mutate()}
                    disabled={!resolutionSummary.trim() || resolveGapMutation.isPending}
                    data-testid="button-confirm-resolve"
                  >
                    {resolveGapMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Resolving...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Confirm Resolution
                      </>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            )}
            
            {userData?.user && isAnyPocOnGap(userData.user.id, gap, gapData?.pocs) && (
              <Dialog open={isExtensionDialogOpen} onOpenChange={setIsExtensionDialogOpen}>
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
                    <Textarea 
                      placeholder="Explain why you need more time..." 
                      rows={3} 
                      value={extensionReason}
                      onChange={(e) => setExtensionReason(e.target.value)}
                      data-testid="input-extension-reason" 
                    />
                  </div>
                  <div>
                    <Label>Requested Deadline</Label>
                    <Input 
                      type="date" 
                      value={extensionDeadline}
                      onChange={(e) => setExtensionDeadline(e.target.value)}
                      data-testid="input-extension-date" 
                    />
                  </div>
                  <Button 
                    className="w-full" 
                    onClick={() => requestExtensionMutation.mutate()}
                    disabled={!extensionReason.trim() || !extensionDeadline || requestExtensionMutation.isPending}
                    data-testid="button-submit-extension"
                  >
                    {requestExtensionMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Submit Request"
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            )}
            
            {userData?.user && ["Management", "QA/Ops", "Admin"].includes(userData.user.role) && 
             gap && (gap.status === "Closed" || gap.status === "Resolved") && (
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => reopenGapMutation.mutate()}
                disabled={reopenGapMutation.isPending}
                data-testid="button-reopen-gap"
              >
                {reopenGapMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Reopening...
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Reopen Gap
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
