innsync

* Description:
- A clone of Airbnb built with Next.js, Tailwind CSS, and various other technologies.

* Installation
* Prerequisites
1. Node.js
2. npm or yarn

*Features
1. User authentication with Clerk
2. Property listings and bookings
3. Reviews and ratings
4. Admin dashboard with statistics
5. Stripe integration for payments

* Deployment (Vercel + Prisma/Postgres)
1. Add these environment variables in Vercel Project Settings:
	- `DATABASE_URL` (preferred)
	- `DIRECT_URL` (recommended for Prisma migrations)
2. If using Vercel Postgres integration, this app can also read:
	- `POSTGRES_PRISMA_URL`
	- `POSTGRES_URL`
3. After setting env vars, redeploy the project.