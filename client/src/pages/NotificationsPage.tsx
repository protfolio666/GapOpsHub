import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function NotificationsPage() {
  const [, setLocation] = useLocation();

  const notifications = [
    {
      id: 1,
      title: "Gap Assigned",
      message: "You have been assigned to gap GAP-0001: System Downtime",
      timestamp: "2 hours ago",
      type: "assignment"
    },
    {
      id: 2,
      title: "Gap Status Updated",
      message: "Gap GAP-0002 has been marked as In Progress",
      timestamp: "4 hours ago",
      type: "status"
    },
    {
      id: 3,
      title: "TAT Extension Approved",
      message: "Your TAT extension request for GAP-0001 has been approved",
      timestamp: "1 day ago",
      type: "tat"
    },
  ];

  const getNotificationColor = (type: string) => {
    switch(type) {
      case "assignment": return "bg-blue-50 dark:bg-blue-950";
      case "status": return "bg-purple-50 dark:bg-purple-950";
      case "tat": return "bg-green-50 dark:bg-green-950";
      default: return "bg-gray-50 dark:bg-gray-950";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/")}
          data-testid="button-back-notifications"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">Stay updated with all your activity</p>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="divide-y">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>No notifications yet</p>
            </div>
          ) : (
            notifications.map(notification => (
              <div
                key={notification.id}
                className={`p-6 transition-colors hover:bg-muted/50 cursor-pointer ${getNotificationColor(notification.type)}`}
                data-testid={`notification-item-${notification.id}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base">{notification.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{notification.timestamp}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
