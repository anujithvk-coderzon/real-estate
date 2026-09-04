import type { JWTPayload } from "jose";

export interface AuthPayload extends JWTPayload {
  id: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export {};
