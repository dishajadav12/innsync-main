import { PrismaClient } from "@prisma/client";

const resolveDatasourceUrl = () => {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    ""
  );
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