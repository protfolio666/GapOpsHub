import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, ArrowLeft, Trash2, Mail, ChevronDown } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";

interface Notification {
  id: number;
  title: string;
  message: string;
  timestamp: string;
  type: string;
  isRead: boolean;
}

export default function NotificationsPage() {
  const [, setLocation] = useLocation();
  const [showAllNotifications, setShowAllNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: 1,
      title: "Gap Assigned",
      message: "You have been assigned to gap GAP-0001: System Downtime",
      timestamp: "2 hours ago",
      type: "assignment",
      isRead: false
    },
    {
      id: 2,
      title: "Gap Status Updated",
      message: "Gap GAP-0002 has been marked as In Progress",
      timestamp: "4 hours ago",
      type: "status",
      isRead: false
    },
    {
      id: 3,
      title: "TAT Extension Approved",
      message: "Your TAT extension request for GAP-0001 has been approved",
      timestamp: "1 day ago",
      type: "tat",
      isRead: true
    },
  ]);

  const handleMarkAsUnread = (id: number) => {
    setNotifications(notifications.map(n => 
      n.id === id ? { ...n, isRead: false } : n
    ));
  };

  const handleRemoveNotification = (id: number) => {
    setNotifications(notifications.filter(n => n.id !== id));
  };

  const handleMarkAsRead = (id: number) => {
    setNotifications(notifications.map(n => 
      n.id === id ? { ...n, isRead: true } : n
    ));
  };

  const getNotificationColor = (type: string, isRead: boolean) => {
    if (isRead) {
      return "bg-muted/30 dark:bg-muted/20";
    }
    switch(type) {
      case "assignment": return "bg-blue-50 dark:bg-blue-950 border-l-4 border-l-blue-500";
      case "status": return "bg-purple-50 dark:bg-purple-950 border-l-4 border-l-purple-500";
      case "tat": return "bg-green-50 dark:bg-green-950 border-l-4 border-l-green-500";
      default: return "bg-gray-50 dark:bg-gray-950 border-l-4 border-l-gray-500";
    }
  };

  const unreadNotifications = notifications.filter(n => !n.isRead);
  const readNotifications = notifications.filter(n => n.isRead);
  const displayedNotifications = showAllNotifications ? notifications : unreadNotifications;

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
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">Stay updated with all your activity</p>
        </div>
        {notifications.length > 0 && (
          <div className="text-sm text-muted-foreground">
            {unreadNotifications.length} unread
          </div>
        )}
      </div>

      <Card className="overflow-hidden">
        <div className="divide-y">
          {displayedNotifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>{showAllNotifications ? "No notifications" : "No unread notifications"}</p>
            </div>
          ) : (
            displayedNotifications.map(notification => (
              <div
                key={notification.id}
                className={`p-6 transition-colors hover:bg-opacity-80 cursor-pointer ${getNotificationColor(notification.type, notification.isRead)}`}
                data-testid={`notification-item-${notification.id}`}
                onClick={() => !notification.isRead && handleMarkAsRead(notification.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className={`font-semibold text-base ${notification.isRead ? "text-muted-foreground" : "text-foreground"}`}>
                        {notification.title}
                      </h3>
                      {!notification.isRead && (
                        <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" data-testid={`unread-indicator-${notification.id}`} />
                      )}
                    </div>
                    <p className={`text-sm mt-1 ${notification.isRead ? "text-muted-foreground/70" : "text-muted-foreground"}`}>
                      {notification.message}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{notification.timestamp}</span>
                    <div className="flex gap-1">
                      {!notification.isRead && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsUnread(notification.id);
                          }}
                          title="Mark as unread"
                          data-testid={`button-mark-unread-${notification.id}`}
                        >
                          <Mail className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveNotification(notification.id);
                        }}
                        title="Remove notification"
                        data-testid={`button-remove-notification-${notification.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {readNotifications.length > 0 && !showAllNotifications && (
          <div className="p-4 bg-muted/30 dark:bg-muted/20 flex items-center justify-center">
            <Button
              variant="ghost"
              onClick={() => setShowAllNotifications(true)}
              className="flex items-center gap-2"
              data-testid="button-show-all-notifications"
            >
              <ChevronDown className="w-4 h-4" />
              Show {readNotifications.length} read {readNotifications.length === 1 ? "notification" : "notifications"}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
