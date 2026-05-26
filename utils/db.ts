import { PrismaClient } from "@prisma/client";

const isLocalDbUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return ["localhost", "127.0.0.1", "0.0.0.0"].includes(parsed.hostname);
  } catch {
    return value.includes("localhost") || value.includes("127.0.0.1") || value.includes("0.0.0.0");
  }
};

// Detects Prisma Cloud / Prisma Accelerate managed URLs.
// These share the hostname db.prisma.io or use the prisma+postgres:// protocol.
// When a Prisma Cloud project is suspended the connection fails at the TCP level,
// so we prefer a direct postgresql:// URL if one is available alongside it.
const isPrismaCloudUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return (
      parsed.hostname === "db.prisma.io" ||
      parsed.hostname.endsWith(".prisma-data.net") ||
      parsed.protocol === "prisma+postgres:"
    );
  } catch {
    return value.includes("db.prisma.io") || value.includes("prisma-data.net");
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

  // Prefer a direct remote postgres:// URL over a Prisma Cloud URL.
  // This means a suspended Prisma Cloud project won't take down the app
  // as long as DIRECT_URL (or a Vercel Postgres URL) points to a live database.
  const directRemote = candidates.find((v) => !isLocalDbUrl(v) && !isPrismaCloudUrl(v));
  if (directRemote) return directRemote;

  const anyRemote = candidates.find((v) => !isLocalDbUrl(v));
  return anyRemote ?? candidates[0] ?? "";
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