import { publicProcedure, router } from "./trpc";
export const systemRouter = router({
  ping: publicProcedure.query(() => ({ status: "ok" as const })),
});
