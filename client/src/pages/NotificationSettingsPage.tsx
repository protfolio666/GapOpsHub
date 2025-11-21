import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Bell } from "lucide-react";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { NotificationPreferences } from "@shared/schema";

export default function NotificationSettingsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);

  const { data: prefsData } = useQuery<{ preferences: NotificationPreferences }>({
    queryKey: ["/api/notification-preferences"]
  });

  useEffect(() => {
    if (prefsData?.preferences) {
      setPreferences(prefsData.preferences);
    }
  }, [prefsData]);

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<NotificationPreferences>) => {
      const response = await fetch("/api/notification-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates)
      });
      if (!response.ok) throw new Error("Failed to update preferences");
      return response.json();
    },
    onSuccess: (data) => {
      setPreferences(data.preferences);
      queryClient.invalidateQueries({ queryKey: ["/api/notification-preferences"] });
      toast({
        title: "Settings saved",
        description: "Your notification preferences have been updated."
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save notification preferences."
      });
    }
  });

  if (!preferences) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Loading settings...
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/")}
          data-testid="button-back-settings"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2" data-testid="text-settings-title">
            <Bell className="w-8 h-8" />
            Notification Settings
          </h1>
          <p className="text-muted-foreground mt-1">Customize how and when you receive notifications</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Notification Frequency</CardTitle>
          <CardDescription>Choose how often you want to receive notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="frequency">Frequency</Label>
            <Select
              value={preferences.frequency}
              onValueChange={(value) => updateMutation.mutate({ frequency: value as any })}
            >
              <SelectTrigger id="frequency" data-testid="select-frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="immediate">Immediate (Real-time)</SelectItem>
                <SelectItem value="daily">Daily Digest</SelectItem>
                <SelectItem value="weekly">Weekly Digest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notification Channels</CardTitle>
          <CardDescription>Where you want to receive notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="channels">Channel Preference</Label>
            <Select
              value={preferences.channels}
              onValueChange={(value) => updateMutation.mutate({ channels: value as any })}
            >
              <SelectTrigger id="channels" data-testid="select-channels">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in-app">In-App Only</SelectItem>
                <SelectItem value="email">Email Only</SelectItem>
                <SelectItem value="both">Both In-App & Email</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notification Types</CardTitle>
          <CardDescription>Choose which types of notifications to receive</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between" data-testid="toggle-gap-assigned">
            <div>
              <Label className="font-medium cursor-pointer">Gap Assigned to You</Label>
              <p className="text-sm text-muted-foreground">When a new gap is assigned to you</p>
            </div>
            <Switch
              checked={preferences.notifyGapAssigned}
              onCheckedChange={(checked) => updateMutation.mutate({ notifyGapAssigned: checked })}
            />
          </div>

          <div className="flex items-center justify-between" data-testid="toggle-gap-resolved">
            <div>
              <Label className="font-medium cursor-pointer">Gap Resolved</Label>
              <p className="text-sm text-muted-foreground">When your gap is marked as resolved</p>
            </div>
            <Switch
              checked={preferences.notifyGapResolved}
              onCheckedChange={(checked) => updateMutation.mutate({ notifyGapResolved: checked })}
            />
          </div>

          <div className="flex items-center justify-between" data-testid="toggle-comment">
            <div>
              <Label className="font-medium cursor-pointer">New Comments</Label>
              <p className="text-sm text-muted-foreground">When someone comments on your gap</p>
            </div>
            <Switch
              checked={preferences.notifyComment}
              onCheckedChange={(checked) => updateMutation.mutate({ notifyComment: checked })}
            />
          </div>

          <div className="flex items-center justify-between" data-testid="toggle-tat-extension">
            <div>
              <Label className="font-medium cursor-pointer">TAT Extension Requests</Label>
              <p className="text-sm text-muted-foreground">When TAT extensions are requested or approved</p>
            </div>
            <Switch
              checked={preferences.notifyTatExtension}
              onCheckedChange={(checked) => updateMutation.mutate({ notifyTatExtension: checked })}
            />
          </div>

          <div className="flex items-center justify-between" data-testid="toggle-overdue-gap">
            <div>
              <Label className="font-medium cursor-pointer">Overdue Gaps</Label>
              <p className="text-sm text-muted-foreground">When your gaps approach or exceed TAT deadline</p>
            </div>
            <Switch
              checked={preferences.notifyOverdueGap}
              onCheckedChange={(checked) => updateMutation.mutate({ notifyOverdueGap: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Master Control</CardTitle>
          <CardDescription>Temporarily disable all notifications</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between" data-testid="toggle-enabled">
            <div>
              <Label className="font-medium cursor-pointer">Notifications Enabled</Label>
              <p className="text-sm text-muted-foreground">Turn all notifications on or off</p>
            </div>
            <Switch
              checked={preferences.enabled}
              onCheckedChange={(checked) => updateMutation.mutate({ enabled: checked })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
