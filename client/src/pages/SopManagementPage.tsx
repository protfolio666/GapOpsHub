import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Pencil, Trash2, Plus, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Sop {
  id: number;
  sopId: string;
  title: string;
  description?: string;
  content: string;
  parentSopId?: number;
  active: boolean;
}

export default function SopManagementPage() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSop, setEditingSop] = useState<Sop | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    content: "",
    parentSopId: "",
  });

  const { data: sopsResponse, isLoading } = useQuery({
    queryKey: ["/api/sops"],
    queryFn: () => apiRequest("GET", "/api/sops") as Promise<{ sops: Sop[] }>,
  });

  const createSopMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/sops", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sops"] });
      toast({ title: "SOP created successfully" });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      console.error("Create SOP error:", error);
      toast({ 
        title: "Failed to create SOP", 
        description: error?.message || "Please check your inputs and try again",
        variant: "destructive" 
      });
    },
  });

  const updateSopMutation = useMutation({
    mutationFn: (data: any) => 
      apiRequest("PATCH", `/api/sops/${editingSop?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sops"] });
      toast({ title: "SOP updated successfully" });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      console.error("Update SOP error:", error);
      toast({ 
        title: "Failed to update SOP", 
        description: error?.message || "Please check your inputs and try again",
        variant: "destructive" 
      });
    },
  });

  const deleteSopMutation = useMutation({
    mutationFn: (sopId: number) => apiRequest("DELETE", `/api/sops/${sopId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sops"] });
      toast({ title: "SOP deleted successfully" });
    },
    onError: (error: any) => {
      console.error("Delete SOP error:", error);
      toast({ 
        title: "Failed to delete SOP", 
        description: error?.message || "Please try again",
        variant: "destructive" 
      });
    },
  });

  const resetForm = () => {
    setFormData({ title: "", description: "", content: "", parentSopId: "" });
    setEditingSop(null);
  };

  const handleOpenDialog = (sop?: Sop) => {
    if (sop) {
      setEditingSop(sop);
      setFormData({
        title: sop.title,
        description: sop.description || "",
        content: sop.content,
        parentSopId: sop.parentSopId?.toString() || "",
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      toast({ title: "Please fill in required fields", variant: "destructive" });
      return;
    }

    const payload = {
      title: formData.title,
      description: formData.description,
      content: formData.content,
      parentSopId: formData.parentSopId && formData.parentSopId !== "none" ? parseInt(formData.parentSopId) : null,
    };

    if (editingSop) {
      updateSopMutation.mutate(payload);
    } else {
      createSopMutation.mutate(payload);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const sops = sopsResponse?.sops || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">SOP Management</h1>
          <p className="text-muted-foreground">Create, update, and organize SOPs</p>
        </div>
        <Button onClick={() => handleOpenDialog()} data-testid="button-create-sop">
          <Plus className="w-4 h-4 mr-2" />
          New SOP
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Title</th>
                <th className="px-4 py-3 text-left font-semibold">SOP ID</th>
                <th className="px-4 py-3 text-left font-semibold">Category</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sops.map((sop) => (
                <tr key={sop.id} className="border-b hover:bg-muted/50" data-testid={`row-sop-${sop.id}`}>
                  <td className="px-4 py-3">{sop.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{sop.sopId}</td>
                  <td className="px-4 py-3 text-muted-foreground">{sop.description?.substring(0, 30)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-md ${sop.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                      {sop.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleOpenDialog(sop)}
                        data-testid={`button-edit-sop-${sop.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteSopMutation.mutate(sop.id)}
                        data-testid={`button-delete-sop-${sop.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSop ? "Edit SOP" : "Create New SOP"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Title *</label>
              <Input
                placeholder="SOP Title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                data-testid="input-sop-title"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Description</label>
              <Input
                placeholder="Brief description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                data-testid="input-sop-description"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Parent SOP (Optional)</label>
              <Select value={formData.parentSopId || "none"} onValueChange={(val) => setFormData({ ...formData, parentSopId: val === "none" ? "" : val })}>
                <SelectTrigger data-testid="select-parent-sop">
                  <SelectValue placeholder="Select parent SOP" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Root SOP)</SelectItem>
                  {sops.filter(s => s.id !== editingSop?.id).map(sop => (
                    <SelectItem key={sop.id} value={sop.id.toString()}>
                      {sop.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Procedure Content *</label>
              <Textarea
                placeholder="Detailed procedure steps and instructions..."
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="min-h-48"
                data-testid="textarea-sop-content"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} data-testid="button-cancel-sop">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createSopMutation.isPending || updateSopMutation.isPending}
              data-testid="button-save-sop"
            >
              {createSopMutation.isPending || updateSopMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save SOP"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
