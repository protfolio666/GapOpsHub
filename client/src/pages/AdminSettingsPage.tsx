import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Settings, Loader2 } from "lucide-react";

const OPENROUTER_MODELS = [
  { value: "meta-llama/llama-3.1-8b-instruct:free", label: "Llama 3.1 8B (Free)" },
  { value: "meta-llama/llama-3.1-70b-instruct", label: "Llama 3.1 70B" },
  { value: "openai/gpt-4-turbo", label: "GPT-4 Turbo (Best Quality)" },
  { value: "openai/gpt-4", label: "GPT-4" },
  { value: "openai/gpt-3.5-turbo", label: "GPT-3.5 Turbo (Fast & Cheap)" },
  { value: "anthropic/claude-3-opus", label: "Claude 3 Opus" },
  { value: "anthropic/claude-3-sonnet", label: "Claude 3 Sonnet" },
  { value: "anthropic/claude-3-haiku", label: "Claude 3 Haiku (Fast)" },
  { value: "google/gemini-pro", label: "Google Gemini Pro" },
  { value: "mistralai/mistral-large", label: "Mistral Large" },
];

interface SystemSettings {
  openrouterModel: string;
}

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const [selectedModel, setSelectedModel] = useState<string>("");

  const { data: settings, isLoading } = useQuery<{ settings: SystemSettings }>({
    queryKey: ["/api/admin/settings"],
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<SystemSettings>) => {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error("Failed to update settings");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({
        title: "Settings updated",
        description: "System settings have been saved successfully.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update settings. Please try again.",
      });
    },
  });

  const handleSaveSettings = () => {
    if (!selectedModel) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select an OpenRouter model.",
      });
      return;
    }

    updateSettingsMutation.mutate({
      openrouterModel: selectedModel,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentModel = settings?.settings?.openrouterModel || "meta-llama/llama-3.1-8b-instruct:free";

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">System Settings</h1>
          <p className="text-muted-foreground">Configure system-wide settings and integrations</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* AI Settings */}
        <Card>
          <CardHeader>
            <CardTitle>AI Configuration</CardTitle>
            <CardDescription>
              Configure the OpenRouter AI model used for gap similarity detection and SOP suggestions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="openrouter-model">OpenRouter Model</Label>
              <Select
                value={selectedModel || currentModel}
                onValueChange={setSelectedModel}
              >
                <SelectTrigger id="openrouter-model" data-testid="select-openrouter-model">
                  <SelectValue placeholder="Select AI model" />
                </SelectTrigger>
                <SelectContent>
                  {OPENROUTER_MODELS.map((model) => (
                    <SelectItem key={model.value} value={model.value}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Current: {OPENROUTER_MODELS.find(m => m.value === currentModel)?.label || currentModel}
              </p>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <h4 className="font-medium text-sm">Model Recommendations:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>GPT-4 Turbo:</strong> Best accuracy for similarity detection (recommended for production)</li>
                <li>• <strong>GPT-3.5 Turbo:</strong> Fast and cost-effective, good for high-volume usage</li>
                <li>• <strong>Llama 3.1 70B:</strong> Open-source alternative with good performance</li>
                <li>• <strong>Llama 3.1 8B (Free):</strong> Free tier, suitable for testing</li>
              </ul>
            </div>

            <Button
              onClick={handleSaveSettings}
              disabled={updateSettingsMutation.isPending || !selectedModel}
              data-testid="button-save-settings"
            >
              {updateSettingsMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Settings"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Email Settings Info */}
        <Card>
          <CardHeader>
            <CardTitle>Email Notifications</CardTitle>
            <CardDescription>
              Email notification settings (configured via environment variables)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">SendGrid Integration</span>
                <span className="text-sm font-medium text-muted-foreground">
                  Check server logs
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Email notifications are sent for gap assignments, resolutions, and TAT extension requests.
                Configure SENDGRID_API_KEY in environment variables to enable email notifications.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
