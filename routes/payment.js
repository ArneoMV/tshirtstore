const express = require("express");
const router = express.Router();
const { isLoggedIn } = require("../middlewares/user");
const {
	sendStripeKeys,
	captureStripePayment,
} = require("../controllers/paymentController");

router.route("/stripekey").get(isLoggedIn, sendStripeKeys); // Route to get Stripe public key
router.route("/capturestripe").post(isLoggedIn, captureStripePayment); // Route to create a checkout session

module.exports = router;
