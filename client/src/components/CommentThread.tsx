import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import UserAvatar from "./UserAvatar";
import { formatDistanceToNow } from "date-fns";
import { Paperclip, Send, Loader2 } from "lucide-react";
import { useState } from "react";

interface Comment {
  id: string;
  author: string;
  content: string;
  createdAt: Date;
  attachments?: string[];
}

interface CommentThreadProps {
  comments: Comment[];
  onAddComment?: (content: string) => Promise<void>;
  isSubmitting?: boolean;
}

export default function CommentThread({ comments, onAddComment, isSubmitting }: CommentThreadProps) {
  const [newComment, setNewComment] = useState("");

  const handleSubmit = async () => {
    if (newComment.trim() && onAddComment) {
      try {
        await onAddComment(newComment);
        setNewComment("");
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
                <div className="flex gap-2 mt-2">
                  {comment.attachments.map((file, idx) => (
                    <div key={idx} className="text-xs bg-muted px-2 py-1 rounded flex items-center gap-1">
                      <Paperclip className="h-3 w-3" />
                      {file}
                    </div>
                  ))}
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
          <div className="flex justify-between items-center">
            <Button variant="outline" size="sm" data-testid="button-attach-file" disabled={isSubmitting}>
              <Paperclip className="h-4 w-4 mr-1" />
              Attach
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={isSubmitting || !newComment.trim()} data-testid="button-submit-comment">
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
