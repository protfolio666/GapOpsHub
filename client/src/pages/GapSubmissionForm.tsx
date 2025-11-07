import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import RichTextEditor from "@/components/RichTextEditor";
import { Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function GapSubmissionForm() {
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Gap submitted:", { title, department, description, attachments });
    toast({
      title: "Gap Submitted",
      description: "Your process gap has been submitted for AI review.",
    });
  };

  const addAttachment = () => {
    setAttachments([...attachments, `document_${Date.now()}.pdf`]);
    console.log("Attachment added");
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6" data-testid="page-gap-submission">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Submit Process Gap</h1>
        <p className="text-sm text-muted-foreground">Report a process gap or operational failure</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Gap Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Gap Title *</Label>
              <Input
                id="title"
                placeholder="e.g., Refund process missing customer notification"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                data-testid="input-gap-title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Department *</Label>
              <Select value={department} onValueChange={setDepartment} required>
                <SelectTrigger id="department" data-testid="select-department">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer-success">Customer Success</SelectItem>
                  <SelectItem value="operations">Operations</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="product">Product</SelectItem>
                  <SelectItem value="engineering">Engineering</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Description *</Label>
              <RichTextEditor
                content={description}
                onChange={setDescription}
                placeholder="Describe the process gap in detail. Include what's missing, the impact, and any relevant context..."
              />
            </div>

            <div className="space-y-2">
              <Label>Attachments</Label>
              <div className="space-y-2">
                {attachments.map((file, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded-md">
                    <span className="text-sm flex-1">{file}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeAttachment(index)}
                      data-testid={`button-remove-attachment-${index}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={addAttachment}
                  className="w-full"
                  data-testid="button-add-attachment"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Add Attachment
                </Button>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" className="flex-1" data-testid="button-submit-gap">
                Submit Gap
              </Button>
              <Button type="button" variant="outline" data-testid="button-cancel">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
