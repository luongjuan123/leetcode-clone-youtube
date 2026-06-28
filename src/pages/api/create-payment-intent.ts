import { withApiErrorHandler } from "@/utils/apiErrorHandler";
import { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";

// Initialize Stripe with the secret key from environment variables
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
	apiVersion: "2022-11-15" as any, // Match a stable API version
});

async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== "POST") {
		return res.status(455).json({ error: "Method not allowed" });
	}

	try {
		const { amount, currency = "usd" } = req.body;

		if (!amount || amount <= 0) {
			return res.status(400).json({ error: "Invalid amount" });
		}

		// Create a PaymentIntent with the specified amount and currency
		const paymentIntent = await stripe.paymentIntents.create({
			amount: Math.round(amount * 100), // Stripe expects amounts in cents
			currency,
			automatic_payment_methods: {
				enabled: true,
			},
		});

		res.status(200).json({
			clientSecret: paymentIntent.client_secret,
		});
	} catch (error: any) {
		console.error("Error creating payment intent:", error);
		res.status(500).json({ error: error.message || "Internal Server Error" });
	}
}

export default withApiErrorHandler(handler);
