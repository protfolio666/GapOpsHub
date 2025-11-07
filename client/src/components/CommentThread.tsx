import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import UserAvatar from "./UserAvatar";
import { formatDistanceToNow } from "date-fns";
import { Paperclip, Send, Loader2, X } from "lucide-react";
import { useState, useRef } from "react";

interface Comment {
  id: string;
  author: string;
  content: string;
  createdAt: Date;
  attachments?: string[];
}

interface CommentThreadProps {
  comments: Comment[];
  onAddComment?: (content: string, attachments: any[]) => Promise<void>;
  isSubmitting?: boolean;
}

export default function CommentThread({ comments, onAddComment, isSubmitting }: CommentThreadProps) {
  const [newComment, setNewComment] = useState("");
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setAttachmentFiles(prev => [...prev, ...Array.from(files)]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachmentFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if ((newComment.trim() || attachmentFiles.length > 0) && onAddComment) {
      try {
        let uploadedFiles: any[] = [];

        // Upload files first if any
        if (attachmentFiles.length > 0) {
          const formData = new FormData();
          attachmentFiles.forEach((file) => {
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

        // Pass uploaded file metadata to parent
        const attachmentData = uploadedFiles.map((f: any) => ({
          originalName: f.originalName,
          filename: f.filename,
          size: f.size,
          mimetype: f.mimetype,
          path: f.path,
        }));

        await onAddComment(newComment, attachmentData);
        setNewComment("");
        setAttachmentFiles([]);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } catch (error) {
        // Error handling is done in parent component
        console.error("Comment submission error:", error);
      }
    }
  };

  return (
    <div className="space-y-4" data-testid="thread-comments">
      {comments.map((comment) => (
        <Card key={comment.id} className="p-4">
          <div className="flex gap-3">
            <UserAvatar name={comment.author} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium">{comment.author}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(comment.createdAt, { addSuffix: true })}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
              {comment.attachments && comment.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {comment.attachments.map((file: any, idx) => {
                    const isFileObject = typeof file === "object" && file.path;
                    const displayName = isFileObject ? file.originalName : file;
                    const downloadPath = isFileObject ? file.path : null;
                    
                    return (
                      <a
                        key={idx}
                        href={downloadPath || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`text-xs bg-muted px-2 py-1 rounded flex items-center gap-1 ${downloadPath ? "hover:bg-muted-foreground/20 cursor-pointer" : ""}`}
                        data-testid={`attachment-link-${idx}`}
                      >
                        <Paperclip className="h-3 w-3" />
                        {displayName}
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Card>
      ))}

      <Card className="p-4">
        <div className="space-y-3">
          <Textarea
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="resize-none"
            rows={3}
            data-testid="input-comment"
          />
          {attachmentFiles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachmentFiles.map((file, idx) => (
                <div key={idx} className="text-xs bg-muted px-2 py-1 rounded flex items-center gap-2" data-testid={`attachment-chip-${idx}`}>
                  <Paperclip className="h-3 w-3" />
                  <span>{file.name}</span>
                  <button
                    onClick={() => removeAttachment(idx)}
                    className="hover:bg-muted-foreground/20 rounded-full p-0.5"
                    data-testid={`button-remove-attachment-${idx}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <Input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            multiple
            className="hidden"
            data-testid="input-file-hidden"
          />
          <div className="flex justify-between items-center">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => fileInputRef.current?.click()}
              disabled={isSubmitting}
              data-testid="button-attach-file"
            >
              <Paperclip className="h-4 w-4 mr-1" />
              Attach
            </Button>
            <Button 
              size="sm" 
              onClick={handleSubmit} 
              disabled={isSubmitting || (!newComment.trim() && attachmentFiles.length === 0)} 
              data-testid="button-submit-comment"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Posting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-1" />
                  Comment
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
