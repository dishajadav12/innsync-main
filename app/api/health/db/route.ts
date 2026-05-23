import { NextResponse } from "next/server";
import db from "@/utils/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
  const hasPostgresPrismaUrl = Boolean(process.env.POSTGRES_PRISMA_URL);
  const hasPostgresUrl = Boolean(process.env.POSTGRES_URL);
  const hasDirectUrl = Boolean(process.env.DIRECT_URL);

  try {
    await db.$queryRaw`SELECT 1`;

    return NextResponse.json(
      {
        ok: true,
        dbReachable: true,
        env: {
          hasDatabaseUrl,
          hasPostgresPrismaUrl,
          hasPostgresUrl,
          hasDirectUrl,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        dbReachable: false,
        env: {
          hasDatabaseUrl,
          hasPostgresPrismaUrl,
          hasPostgresUrl,
          hasDirectUrl,
        },
        message: error instanceof Error ? error.message : "Database connection failed",
      },
      { status: 500 }
    );
  }
}
