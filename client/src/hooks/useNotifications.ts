import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface Notification {
  id: number;
  title: string;
  message: string;
  timestamp: string;
  type: string;
  isRead: boolean;
  gapId?: string;
  gapTitle?: string;
}

export function useNotifications() {
  return useQuery({
    queryKey: ['/api/notifications'],
    queryFn: () => apiRequest('/api/notifications').then(res => res.json()),
  });
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ['/api/notifications/count'],
    queryFn: () => apiRequest('/api/notifications/count').then(res => res.json()),
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}
