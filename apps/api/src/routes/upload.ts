import type { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function uploadRoutes(app: FastifyInstance) {
  await app.register(multipart, {
    limits: { fileSize: MAX_FILE_SIZE },
  });

  /** POST /upload/profile-image — upload a profile image, returns base64 data URI */
  app.post('/profile-image', { preHandler: [app.authenticate] }, async (req, reply) => {
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: 'No file uploaded' });

    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return reply.code(400).send({ error: 'Invalid file type. Use JPEG, PNG, WebP, or GIF.' });
    }

    const chunks: Buffer[] = [];
    for await (const chunk of file.file) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    if (buffer.length > MAX_FILE_SIZE) {
      return reply.code(400).send({ error: 'File too large. Maximum 2MB.' });
    }

    if (buffer.length === 0) {
      return reply.code(400).send({ error: 'Empty file uploaded' });
    }

    const base64 = buffer.toString('base64');
    const dataUri = `data:${file.mimetype};base64,${base64}`;

    return { url: dataUri };
  });
}
