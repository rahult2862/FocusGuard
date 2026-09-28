import jwt from "jsonwebtoken";

const secret = process.env.JWT_SECRET;

if (!secret && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET must be set in production");
}

export const jwtSecret = secret ?? "local-development-only-change-this-secret";

export function createToken(userId: string): string {
  return jwt.sign({ sub: userId }, jwtSecret, { expiresIn: "14d" });
}
