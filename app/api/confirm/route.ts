// Payment disabled.
// import Stripe from "stripe";
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
// import db from "@/utils/db";

export const GET = async () => {
  // const { searchParams } = new URL(req.url);
  // const session_id = searchParams.get("session_id") as string;

  // try {
  //   const session = await stripe.checkout.sessions.retrieve(session_id);
  //   const bookingId = session.metadata?.bookingId;
  //   if (session.status === "complete" && bookingId) {
  //     await db.booking.update({
  //       where: { id: bookingId },
  //       data: { paymentStatus: true },
  //     });
  //   }
  // } catch (err) {
  //   console.log(err);
  //   return Response.json(null, {
  //     status: 500,
  //     statusText: "Internal Server Error",
  //   });
  // }

  return Response.json(
    { message: "Payment confirmation is disabled" },
    {
      status: 410,
      statusText: "Gone",
    }
  );
};