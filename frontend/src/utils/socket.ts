import { io, Socket } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || "http://localhost:8000";

let socket: Socket | null = null;

/**
 * Initializes and establishes the Socket.IO connection.
 * Passes the authorization token (Firebase or Mock) inside the connection auth payload.
 */
export const connectSocket = (token: string): Socket => {
  if (socket) {
    socket.disconnect();
  }
  
  socket = io(SOCKET_URL, {
    auth: {
      token,
    },
    transports: ["websocket"],
    autoConnect: true,
  });

  return socket;
};

/**
 * Retrieves the currently active socket client.
 */
export const getSocket = (): Socket | null => {
  return socket;
};

/**
 * Terminates the socket connection and cleans up references.
 */
export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
