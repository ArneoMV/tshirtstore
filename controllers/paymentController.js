const BigPromise = require("../middlewares/bigPromise");
const stripe = require("stripe")(process.env.STRIPE_SECRET);

// Send Stripe Public Key
exports.sendStripeKeys = BigPromise(async (req, res, next) => {
    res.status(200).json({
        stripekey: process.env.STRIPE_API_KEY, // Public Stripe API Key
    });
});

// Create Checkout Session
exports.captureStripePayment = BigPromise(async (req, res, next) => {
    try {
        const { product, amount } = req.body;

        // Input validation
        if (!product?.name || !amount) {
            return res.status(400).json({ error: "Product name and amount are required." });
        }

        // Create Stripe checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: [
                {
                    price_data: {
                        currency: "eur",
                        product_data: { name: product.name },
                        unit_amount: amount,
                    },
                    quantity: 1,
                },
            ],
            mode: "payment",
            success_url: `${process.env.FRONTEND_URL}/success`, // Use an environment variable for the frontend URL
            cancel_url: `${process.env.FRONTEND_URL}/cancel`,
            metadata: { integration_check: "accept_a_payment" },
        });

        res.status(200).json({
            success: true,
            sessionId: session.id, // Send session ID for frontend use
            url: session.url, // Provide URL for redirection
        });
    } catch (error) {
        console.error("Error creating Stripe session:", error);
        res.status(500).json({ error: "Failed to create Stripe checkout session." });
    }
});
