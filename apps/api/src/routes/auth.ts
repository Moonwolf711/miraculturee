import type { FastifyInstance } from 'fastify';
import { RegisterSchema, LoginSchema, RefreshSchema } from '@miraculturee/shared';
import { AuthService } from '../services/auth.service.js';

export async function authRoutes(app: FastifyInstance) {
  const authService = new AuthService(app.prisma, app);

  app.post('/register', async (req, reply) => {
    const body = RegisterSchema.parse(req.body);
    const tokens = await authService.register(body.email, body.password, body.name, body.role);
    return reply.code(201).send(tokens);
  });

  app.post('/login', async (req, reply) => {
    const body = LoginSchema.parse(req.body);
    const tokens = await authService.login(body.email, body.password);
    return reply.send(tokens);
  });

  app.post('/refresh', async (req, reply) => {
    const body = RefreshSchema.parse(req.body);
    const tokens = await authService.refresh(body.refreshToken);
    return reply.send(tokens);
  });

  app.get('/me', { preHandler: [app.authenticate] }, async (req) => {
    const user = await app.prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, name: true, role: true, city: true, createdAt: true },
    });
    return user;
  });
}
