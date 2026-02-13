import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Role } from '@miraculturee/shared';

export function requireRole(...roles: Role[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    await req.jwtVerify();
    if (!roles.includes(req.user.role)) {
      return reply.code(403).send({ error: 'Forbidden: insufficient role' });
    }
  };
}
