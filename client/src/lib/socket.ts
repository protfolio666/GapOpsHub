import { io as ioClient, Socket } from "socket.io-client";
import { queryClient } from "./queryClient";

let socket: Socket | null = null;

export function initializeSocket() {
  if (socket) return socket;

  socket = ioClient(window.location.origin, {
    withCredentials: true,
  });

  // Listen for real-time gap updates and invalidate cache
  socket.on("gap:updated", (data: any) => {
    console.log("Gap updated via socket:", data);
    
    // Invalidate all gap-related queries to trigger refetch
    queryClient.invalidateQueries({ queryKey: ['/api/gaps'] });
    queryClient.invalidateQueries({ queryKey: ['/api/gaps', data.gapId] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/gaps'] });
    queryClient.invalidateQueries({ queryKey: ['/api/management/gaps'] });
    queryClient.invalidateQueries({ queryKey: ['/api/poc/gaps'] });
    queryClient.invalidateQueries({ queryKey: ['/api/qa/gaps'] });
    queryClient.invalidateQueries({ queryKey: ['/api/reports'] });
    queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    queryClient.invalidateQueries({ queryKey: ['/api/notifications/count'] });
  });

  // Listen for comment updates
  socket.on("new-comment", () => {
    console.log("New comment received via socket");
    queryClient.invalidateQueries({ queryKey: ['/api/gaps'] });
  });

  // Listen for connection errors
  socket.on("connect_error", (error) => {
    console.error("Socket connection error:", error);
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected");
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
