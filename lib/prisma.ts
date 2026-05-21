<<<<<<< HEAD
=======
// Import env validation first — fails fast if required vars are missing or
// PAYMENT_SIMULATION_MODE is enabled in production (Issue #10)
import "@/lib/env";

>>>>>>> 13d2b43 (first commit)
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
<<<<<<< HEAD
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
=======
    log:
      process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
>>>>>>> 13d2b43 (first commit)
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
