import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

// Stripe is optional — billing features degrade gracefully without it
export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: "2025-12-18.acacia" as Stripe.LatestApiVersion })
  : null;

export const STRIPE_PRICES = {
  growth_monthly: process.env.STRIPE_GROWTH_PRICE_ID || "",
  enterprise_monthly: process.env.STRIPE_ENTERPRISE_PRICE_ID || "",
};

export function isStripeConfigured(): boolean {
  return stripe !== null;
}
