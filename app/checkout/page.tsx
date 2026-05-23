'use client';
import React from 'react';

// Payment flow disabled.
// import axios from 'axios';
// import { useSearchParams } from 'next/navigation';
// import { useCallback } from 'react';
// import { loadStripe } from '@stripe/stripe-js';
// import {
//   EmbeddedCheckoutProvider,
//   EmbeddedCheckout,
// } from '@stripe/react-stripe-js';

// const stripePromise = loadStripe(
//   process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string
// );

function CheckoutPage() {
  // const searchParams = useSearchParams();
  // const bookingId = searchParams.get('bookingId');

  // const fetchClientSecret = useCallback(async () => {
  //   const response = await axios.post('/api/payment', {
  //     bookingId: bookingId,
  //   });
  //   return response.data.clientSecret;
  // }, []);

  // const options = { fetchClientSecret };

  return (
    <div id='checkout' className='container py-10'>
      <h2 className='text-xl font-semibold mb-2'>Checkout Disabled</h2>
      <p className='text-muted-foreground'>
        Online payment is currently disabled for this project.
      </p>
    </div>
  );
}
export default CheckoutPage;