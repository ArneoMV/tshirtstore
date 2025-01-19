const User = require("../models/user");
const BigPromise = require("../middlewares/bigPromise");
const CustomError = require("../utils/customError");
const cookieToken = require("../utils/cookieToken");
// const fileUpload = require("express-fileupload");
const cloudinary = require("cloudinary");
const mailHelper = require("../utils/emailHelper");
const crypto = require("crypto");
const mongoose = require("mongoose");

exports.signup = BigPromise(async (req, res, next) => {
	// let result;

	if (!req.files) {
		return next(new CustomError("Photo is required for signup", 400));
	}

	const { name, email, password } = req.body;

	if (!email || !name || !password) {
		return next(new CustomError("Name, email and password are required!", 400));
	}

	let file = req.files.photo;

	const result = await cloudinary.v2.uploader.upload(file.tempFilePath, {
		folder: "users",
		width: 150,
		crop: "scale",
	});

	const user = await User.create({
		name,
		email,
		password,
		photo: {
			id: result.public_id,
			secure_url: result.secure_url,
		},
	});

	cookieToken(user, res);
});

exports.login = BigPromise(async (req, res, next) => {
	const { email, password } = req.body;

	// check for presence of email and password
	if (!email || !password) {
		return next(new CustomError("Please provide email and password", 400));
	}

	// get user from db
	const user = await User.findOne({ email }).select("+password");

	// if user not found in db
	if (!user) {
		return next(
			new CustomError("Email or password does not match or exist", 400)
		);
	}

	// matvh the password
	const isPasswordCorrect = await user.isValidatedPassword(password);

	// if password do not match
	if (!isPasswordCorrect) {
		return next(
			new CustomError("Email or password does not match or exist", 400)
		);
	}

	// if all goes good we send the token
	cookieToken(user, res);
});

exports.logout = BigPromise(async (req, res, next) => {
	res.cookie("token", null, {
		expires: new Date(Date.now()),
		httpOnly: true,
	});
	res.status(200).json({
		success: true,
		message: "Logout success",
	});
});

exports.forgotPassword = BigPromise(async (req, res, next) => {
	const { email } = req.body;

	// Provjera korisnika
	const user = await User.findOne({ email });

	if (!user) {
		return next(new CustomError("Email not found as registered", 400));
	}

	// Generiranje zaboravljenog tokena
	const forgotToken = user.getForgotPasswordToken();

	// Sprema korisnika bez validacije
	await user.save({ validateBeforeSave: false });

	// Kreiranje URL-a
	const myUrl = `${req.protocol}://${req.get(
		"host"
	)}/api/v1/password/reset/${forgotToken}`;
	const message = `Copy-paste this link in your browser and hit enter:\n\n${myUrl}`;

	try {
		// Slanje e-maila
		await mailHelper({
			email: user.email,
			subject: "Password Reset Email",
			message,
		});

		res.status(200).json({
			success: true,
			message: "Email sent successfully",
		});
	} catch (error) {
		// Resetiraj token i spremi korisnika
		user.forgotPasswordToken = undefined;
		user.forgotPasswordExpiry = undefined;
		await user.save({ validateBeforeSave: false });

		return next(new CustomError(error.message, 500));
	}
});

exports.passwordReset = BigPromise(async (req, res, next) => {
	const token = req.params.token;

	// Hash token
	const encryToken = crypto.createHash("sha256").update(token).digest("hex");

	// Find user with valid token and expiry
	const user = await User.findOne({
		forgotPasswordToken: encryToken,
		forgotPasswordExpiry: { $gt: Date.now() },
	});

	if (!user) {
		return next(new CustomError("Invalid or expired token", 400));
	}

	// Validate password and confirmPassword
	if (!req.body.password || !req.body.confirmPassword) {
		return next(new CustomError("Password fields are required!", 400));
	}

	if (req.body.password !== req.body.confirmPassword) {
		return next(
			new CustomError("Password and confirm password do not match!", 400)
		);
	}

	// Update user password and clear reset tokens
	user.password = req.body.password;
	user.forgotPasswordToken = undefined;
	user.forgotPasswordExpiry = undefined;

	await user.save();

	// Send token or success response
	cookieToken(user, res);
});

exports.getLoggedInUserDetails = BigPromise(async (req, res, next) => {
	try {
		// Pokušaj dohvatiti korisnika prema ID-u spremljenom u tokenu
		const user = await User.findById(req.user.id);

		// Provjeri da li korisnik postoji u bazi podataka
		if (!user) {
			// Ako korisnik nije pronađen, šaljemo odgovarajuću grešku
			return next(new CustomError("User not found", 404));
		}

		// Ako je korisnik pronađen, šaljemo uspješan odgovor
		res.status(200).json({
			success: true,
			user, // Ovdje možeš odlučiti koji podaci o korisniku će biti poslani
		});
	} catch (error) {
		// Ako dođe do greške tijekom upita ili obrade, šaljemo grešku
		console.error("Error fetching user details:", error); // Logiranje greške za debuggiranje
		return next(
			new CustomError("Something went wrong while fetching user details", 500)
		);
	}
});

exports.changePassword = BigPromise(async (req, res, next) => {
	const userId = req.user.id;

	const user = await User.findById(userId).select("+password");

	const isCorrectOldPassword = await user.isValidatedPassword(
		req.body.oldPassword
	);

	if (!isCorrectOldPassword) {
		return next(new CustomError("Old password id incorrect", 400));
	}

	user.password = req.body.password;

	await user.save();

	cookieToken(user, res);
});

exports.updateUserDetails = BigPromise(async (req, res, next) => {
	const { name, email } = req.body;

	// Provjera obaveznih polja
	if (!name || !email) {
		return next(new CustomError("Name and email are required", 400));
	}

	const newData = { name, email };

	// Provjera postoji li nova slika
	if (req.files && req.files.photo) {
		const user = await User.findById(req.user.id);

		if (!user) {
			return next(new CustomError("User not found", 404));
		}

		// Brisanje stare slike
		if (user.photo && user.photo.id) {
			await cloudinary.v2.uploader.destroy(user.photo.id);
		}

		// Prijenos nove slike
		const result = await cloudinary.v2.uploader.upload(
			req.files.photo.tempFilePath,
			{
				folder: "users",
				width: 150,
				crop: "scale",
			}
		);

		newData.photo = {
			id: result.public_id,
			secure_url: result.secure_url,
		};
	}

	// Ažuriranje korisnika u bazi
	const user = await User.findByIdAndUpdate(req.user.id, newData, {
		new: true,
		runValidators: true,
		useFindAndModify: false,
	});

	if (!user) {
		return next(new CustomError("User not found", 404));
	}

	// Povrat odgovora s ažuriranim podacima
	res.status(200).json({
		success: true,
		user,
	});

	// Obnavljanje kolačića
	cookieToken(user, res);
});

exports.adminAllUsers = BigPromise(async (req, res, next) => {
	const users = await User.find();

	res.status(200).json({
		success: true,
		users,
	});
});

exports.adminGetOneUser = BigPromise(async (req, res, next) => {
	const user = await User.findById(req.params.id);

	if (!user) {
		next(new CustomError("No user found", 400));
	}

	res.status(200).json({
		success: true,
		user,
	});
});

exports.adminUpdateOneUserDetails = BigPromise(async (req, res, next) => {
	const { name, email, role } = req.body;
	const { id } = req.params;

	// Validacija ID-a
	if (!mongoose.Types.ObjectId.isValid(id)) {
		return next(new CustomError("Invalid user ID", 400));
	}

	// Provjera obaveznih polja
	if (!name?.trim() || !email?.trim()) {
		return next(
			new CustomError("Name and email are required and cannot be empty", 400)
		);
	}

	// Provjera valjanosti role
	const allowedRoles = ["admin", "user", "manager"];
	if (role && !allowedRoles.includes(role)) {
		return next(new CustomError("Invalid role value", 400));
	}

	// Proveravamo da li već postoji korisnik sa istim email-om
	const existingUser = await User.findOne({ email });

	if (existingUser && existingUser.id !== id) {
		return next(
			new CustomError(
				"Cannot update user details. The provided email already exists in the database.",
				400
			)
		);
	}

	const newData = { name, email, role };

	// Ažuriranje korisnika u bazi
	const user = await User.findByIdAndUpdate(id, newData, {
		new: true,
		runValidators: true,
		useFindAndModify: false,
	});

	if (!user) {
		return next(new CustomError("User not found", 404));
	}

	// Povrat odgovora s ažuriranim podacima
	res.status(200).json({
		success: true,
		user,
	});
});

exports.adminDeleteOneUser = BigPromise(async (req, res, next) => {
	const user = await User.findById(req.params.id);

	if (!user) {
		return next(new CustomError("No such user found"), 401);
	}

	const imageId = user.photo.id;

	await cloudinary.v2.uploader.destroy(imageId);

	await user.remove();

	res.status(200).json({
		success: true,
	});
});

exports.managerAllUsers = BigPromise(async (req, res, next) => {
	const users = await User.find({ role: "user" });

	res.status(200).json({
		success: true,
		users,
	});
});
