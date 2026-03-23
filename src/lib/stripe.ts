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

// One-time credit packs for Stripe Checkout
export const CREDIT_PACKS = [
  {
    id: "credits_1000",
    name: "1,000 TA Credits",
    credits: 1000,
    price_cents: 1900, // $19.00
    description: "~20 agent prompts",
  },
  {
    id: "credits_5000",
    name: "5,000 TA Credits",
    credits: 5000,
    price_cents: 7500, // $75.00 ($15/1000)
    description: "~100 agent prompts — best value",
  },
] as const;

export type CreditPackId = (typeof CREDIT_PACKS)[number]["id"];

export function isStripeConfigured(): boolean {
  return stripe !== null;
}
