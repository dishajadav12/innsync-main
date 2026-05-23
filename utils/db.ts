import { PrismaClient } from "@prisma/client";

const isLocalDbUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return ["localhost", "127.0.0.1", "0.0.0.0"].includes(parsed.hostname);
  } catch {
    return value.includes("localhost") || value.includes("127.0.0.1") || value.includes("0.0.0.0");
  }
};

const resolveDatasourceUrl = () => {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL,
    process.env.DIRECT_URL,
    process.env.DATABASE_VERCEL_PRISMA_DATABASE_URL,
    process.env.DATABASE_VERCEL_POSTGRES_URL,
    process.env.DATABASE_VERCEL_DATABASE_URL,
  ].filter((value): value is string => Boolean(value));

  if (process.env.NODE_ENV !== "production") {
    return candidates[0] ?? "";
  }

  const remoteCandidate = candidates.find((value) => !isLocalDbUrl(value));
  return remoteCandidate ?? candidates[0] ?? "";
};

const prismaClientSingleton = () => {
  const datasourceUrl = resolveDatasourceUrl();

  if (datasourceUrl) {
    return new PrismaClient({
      datasources: {
        db: {
          url: datasourceUrl,
        },
      },
    });
  }

  return new PrismaClient();
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;