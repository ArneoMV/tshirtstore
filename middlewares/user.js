const User = require("../models/user");
const BigPromise = require("../middlewares/bigPromise");
const CustomError = require("../utils/customError");
const jwt = require("jsonwebtoken");

// Middleware za provjeru da li je korisnik prijavljen
exports.isLoggedIn = BigPromise(async (req, res, next) => {
	// Prvo pokušaj dohvatiti token iz cookie-a, ako nije prisutan, pokušaj iz Authorization headera
	const token =
		req.cookies.token ||
		req.header("Authorization")?.replace("Bearer", "").trim();

	// Ako token nije prisutan, šaljemo grešku
	if (!token) {
		return next(new CustomError("Login first to access this page", 401));
	}

	try {
		// Dekodiranje JWT tokena, ovo vraća payload (u ovom slučaju korisnički ID)
		const decoded = jwt.verify(token, process.env.JWT_SECRET);

		// Provjera je li decoded id prisutan, ukoliko nije, šaljemo grešku
		if (!decoded || !decoded.id) {
			return next(new CustomError("Invalid token payload", 401));
		}

		// Na temelju ID-a iz tokena, tražimo korisnika u bazi podataka
		req.user = await User.findById(decoded.id);

		// Provjerava je li korisnik pronađen u bazi podataka
		if (!req.user) {
			return next(new CustomError("User not found", 404));
		}

		// Ako sve ide u redu, prosljeđujemo kontrolu dalje
		next();
	} catch (error) {
		// Ako JWT nije valjan ili se dogodila neka druga pogreška, šaljemo grešku
		console.log("JWT verification failed:", error); // Logiranje greške za praćenje problema

		// Provjera vrste greške
		if (error.name === "JsonWebTokenError") {
			return next(new CustomError("Invalid token", 401));
		}
		// Ako je token istekao
		if (error.name === "TokenExpiredError") {
			return next(new CustomError("Token has expired", 401));
		}

		// Za ostale nepredviđene greške
		return next(
			new CustomError("An error occurred while verifying token", 500)
		);
	}
});

exports.customRole = (...roles) => {
	return (req, res, next) => {
		if (!roles.includes(req.user.role)) {
			return next(
				new CustomError("You are not allowed for this resource", 403)
			);
		}

		next();
	};

	// if(req.user.role === 'admin') {
	// 	next()
	// }
};
