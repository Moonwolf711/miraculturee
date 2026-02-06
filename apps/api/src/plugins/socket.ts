import fp from 'fastify-plugin';
import { Server } from 'socket.io';
import type { FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    io: Server;
  }
}

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

    socket.on('disconnect', () => {
      app.log.info(`Socket disconnected: ${socket.id}`);
    });
  });

  app.addHook('onClose', async () => {
    io.close();
  });
});
