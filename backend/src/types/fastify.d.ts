// backend/src/types/fastify.d.ts
// Fastify TypeScript module augmentation for custom decorators and JWT user

import "fastify";
import "@fastify/jwt";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    user: {
      userId: string;
      phone: string;
      plan?: string;
      role?: string;
    };
  }
}
