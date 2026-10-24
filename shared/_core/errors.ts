import { TRPCError } from "@trpc/server";
export function ForbiddenError(message = "Acceso denegado") {
  return new TRPCError({ code: "FORBIDDEN", message });
}
export function UnauthorizedError(message = "Sesión no autorizada") {
  return new TRPCError({ code: "UNAUTHORIZED", message });
}
