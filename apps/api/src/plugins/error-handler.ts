import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

export const errorHandlerPlugin = fp(async (app: FastifyInstance) => {
  app.setErrorHandler((error: Error & { statusCode?: number }, _req, reply) => {
    // Zod validation errors
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: 'Validation error',
        details: error.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      });
    }

    // Custom errors with statusCode
    const statusCode = error.statusCode ?? 500;
    if (statusCode >= 500) {
      app.log.error(error);
    }

    return reply.code(statusCode).send({
      error: error.message ?? 'Internal server error',
    });
  });
});
