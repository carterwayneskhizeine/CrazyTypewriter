import { Server as SocketIOServer, Socket } from 'socket.io';
import { updateDocument, getDocument } from '../services/syncService';

interface SocketData {
  user?: {
    id: number;
    username: string;
  };
}

export function setupSocketHandlers(io: SocketIOServer) {
  // Authentication middleware for Socket.io
  io.use(async (socket: Socket, next) => {
    const auth = socket.handshake.auth as { userId?: number; username?: string };

    if (!auth.userId || !auth.username) {
      return next(new Error('Authentication error: No user credentials provided'));
    }

    // Use user info from auth (passed from frontend)
    socket.data.user = {
      id: auth.userId,
      username: auth.username
    };
    next();
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket.data as SocketData).user;
    if (!user) {
      socket.disconnect();
      return;
    }

    const userId = user.id;
    const roomName = `user:${userId}`;

    console.log(`User ${user.username} (${userId}) connected from device ${socket.id}`);

    // Join user-specific room
    socket.join(roomName);

    // Send initial document content
    const doc = getDocument(userId, user.username);
    socket.emit('content:loaded', {
      content: doc.content,
      version: doc.version
    });

    // Handle content updates
    socket.on('content:update', async (data: { content: string; version: number; deviceId: string }) => {
      try {
        const { content, version, deviceId } = data;

        console.log(`Content update from user ${userId}, device ${deviceId}, version ${version}`);

        const result = updateDocument(userId, user.username, content, version);

        if (result.success && result.document) {
          // Broadcast to other devices
          socket.to(roomName).emit('content:updated', {
            content: result.document.content,
            version: result.document.version,
            fromDeviceId: deviceId
          });

          // Confirm success to sender
          socket.emit('sync:success', {
            version: result.document.version,
            timestamp: new Date().toISOString()
          });
        } else if (result.conflict) {
          // Version conflict
          socket.emit('sync:conflict', {
            serverVersion: result.serverVersion,
            serverContent: result.serverContent,
            clientVersion: version
          });
        } else {
          // Other error
          socket.emit('sync:error', { message: 'Failed to sync content' });
        }
      } catch (error) {
        console.error('Error handling content:update:', error);
        socket.emit('sync:error', { message: 'Internal server error' });
      }
    });

    // Handle manual sync request
    socket.on('sync:request', async () => {
      try {
        const doc = getDocument(userId, user.username);
        socket.emit('content:loaded', {
          content: doc.content,
          version: doc.version
        });
      } catch (error) {
        console.error('Error handling sync:request:', error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User ${user.username} (${userId}) disconnected`);
    });
  });

  console.log('Socket.io handlers initialized');
}
