import fp from 'fastify-plugin';
import { Server } from 'socket.io';
import type { FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    io: Server;
  }
}

const HEARTBEAT_INTERVAL_MS = 30_000;

export const socketPlugin = fp(async (app: FastifyInstance) => {
  const io = new Server(app.server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    path: '/ws',
  });

  app.decorate('io', io);

  io.on('connection', (socket) => {
    app.log.info(`Socket connected: ${socket.id}`);

    socket.on('join:event', (eventId: string) => {
      socket.join(`event:${eventId}`);
    });

    // Generic subscribe/unsubscribe — maps channel names to Socket.IO rooms
    socket.on('subscribe', (channel: string) => {
      if (typeof channel !== 'string') return;
      socket.join(channel);
    });

    socket.on('unsubscribe', (channel: string) => {
      if (typeof channel !== 'string') return;
      socket.leave(channel);
    });

    socket.on('disconnect', () => {
      app.log.info(`Socket disconnected: ${socket.id}`);
    });
  });

  // Server-side heartbeat — keeps connections alive and lets clients detect staleness
  const heartbeatInterval = setInterval(() => {
    io.emit('heartbeat', { type: 'heartbeat', ts: Date.now() });
  }, HEARTBEAT_INTERVAL_MS);

  app.addHook('onClose', async () => {
    clearInterval(heartbeatInterval);
    io.close();
  });
});
