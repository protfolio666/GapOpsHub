import { io as ioClient, Socket } from "socket.io-client";
import { queryClient } from "./queryClient";

let socket: Socket | null = null;

export function initializeSocket() {
  if (socket && socket.connected) {
    console.log("✅ Socket already connected");
    return socket;
  }

  if (socket) {
    console.log("🔄 Reconnecting existing socket...");
    socket.connect();
    return socket;
  }

  console.log("🔌 Initializing new socket connection...");
  socket = ioClient(window.location.origin, {
    withCredentials: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
    forceNew: false,
  });

  socket.on("connect", () => {
    console.log("✅ Socket connected:", socket?.id);
  });

  // Listen for real-time gap updates and invalidate cache
  socket.on("gap:updated", (data: any) => {
    console.log("🔄 Gap updated via socket:", data);
    
    // Invalidate all gap-related queries with broader matching
    queryClient.invalidateQueries({ 
      predicate: (query) => {
        const key = query.queryKey;
        const keyStr = String(key);
        return keyStr.includes('/api/gaps') || 
               keyStr.includes('/api/reports') || 
               keyStr.includes('/api/admin') || 
               keyStr.includes('/api/management') || 
               keyStr.includes('/api/poc') || 
               keyStr.includes('/api/qa') ||
               keyStr.includes('/api/notifications') ||
               keyStr.includes('/api/overdue');
      }
    });
  });

  // Listen for comment updates
  socket.on("new-comment", () => {
    console.log("💬 New comment received via socket");
    queryClient.invalidateQueries({ queryKey: ['/api/gaps'] });
  });

  // Listen for connection errors
  socket.on("connect_error", (error) => {
    console.error("❌ Socket connection error:", error);
  });

  socket.on("disconnect", (reason) => {
    console.log("⚠️ Socket disconnected:", reason);
    if (reason === "io server disconnect") {
      socket?.connect();
    }
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
