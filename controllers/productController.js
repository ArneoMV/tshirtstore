const BigPromise = require("../middlewares/bigPromise"); // Middleware za upravljanje asinkronim funkcijama i greškama.
const Product = require("../models/product"); // Mongoose model za proizvode.
const CustomError = require("../utils/customError"); // Custom greška za specifične slučajeve.
const cloudinary = require("cloudinary"); // Cloudinary SDK za upravljanje uploadom slika.
const WhereClause = require("../utils/whereClause"); // Klasa za fleksibilno filtriranje, pretraživanje i straničenje.

// Kontroler za dodavanje proizvoda.
exports.addProduct = BigPromise(async (req, res, next) => {
	// Polje za spremanje podataka o slikama koje će se uploadati.
	let imageArray = [];

	// Provjera je li korisnik poslao slike.
	if (!req.files) {
		// Ako slike nisu poslane, baca grešku putem `CustomError`.
		return next(new CustomError("Images are required!", 401));
	}

	// Ako slike postoje, prolazi kroz sve slike i uploaduje ih na Cloudinary.
	if (req.files) {
		for (let index = 0; index < req.files.photos.length; index++) {
			// Greška ovdje: koristiš `array.length` umjesto `req.files.photos.length`.
			// Upload svake slike na Cloudinary.
			let result = await cloudinary.v2.uploader.upload(
				req.files.photos[index].tempFilePath, // Putanja do privremene slike.
				{
					folder: "products", // Postavlja folder unutar Cloudinary računa.
				}
			);

			// Dodaje informacije o slici u `imageArray`.
			imageArray.push({
				id: result.public_id, // Jedinstveni ID slike na Cloudinary.
				secure_url: result.secure_url, // URL slike.
			});
		}
	}

	// Dodavanje informacija o slikama u `req.body` kako bi bile spremljene u bazu.
	req.body.photos = imageArray;

	// Povezivanje proizvoda s korisnikom koji ga je kreirao.
	req.body.user = req.user.id;

	// Stvaranje novog proizvoda u bazi podataka.
	const product = await Product.create(req.body);

	// Slanje uspješnog odgovora s podacima o novom proizvodu.
	res.status(200).json({
		success: true,
		product,
	});
});

// Kontroler za dohvaćanje svih proizvoda s pretraživanjem, filtriranjem i straničenjem.
exports.getAllProduct = BigPromise(async (req, res, next) => {
	const query = req.query || {};

	const resultperPage = 6; // Broj proizvoda po stranici.
	const totalCountProducts = await Product.countDocuments(); // Ukupan broj proizvoda u bazi.

	// Inicijalizacija `WhereClause` klase s osnovnim queryjem i parametrima iz `req.query`.
	const productsQuery = new WhereClause(Product.find(), req.query || {})
		.search()
		.filter();

	// Kloniranje queryja za filtrirane proizvode prije paginacije.
	let filteredProducts = await productsQuery.base.clone(); // Kloniramo query kako bismo dobili filtrirane proizvode.

	// Broj filtriranih proizvoda.
	const filteredProductNumber = filteredProducts.length;

	// Primjena straničenja na query.
	productsQuery.pager(resultperPage);

	// Izvršavanje queryja sa straničenjem.
	const products = await productsQuery.base.clone();

	// Slanje uspješnog odgovora s podacima o proizvodima.
	res.status(200).json({
		success: true,
		products, // Dohvaćeni proizvodi sa straničenjem.
		filteredProductNumber, // Broj proizvoda nakon filtriranja.
		totalCountProducts, // Ukupan broj proizvoda u bazi.
	});
});

exports.getOneProduct = BigPromise(async (req, res, next) => {
	const product = await Product.findById(req.params.id);

	if (!product) {
		return next(new CustomError("No product found with this id"), 401);
	}

	res.status(200).json({
		success: true,
		product,
	});
});

exports.addReview = BigPromise(async (req, res, next) => {
	const { rating, comment, productId } = req.body;

	const review = {
		user: req.user._id,
		name: req.user.name,
		rating: Number(rating),
		comment,
	};

	const product = await Prodct.findById(productId);

	const AlreadyReview = product.reviews.find(
		(rev) => rev.user.toString() === req.user._id.toString()
	);

	if (AlreadyReview) {
		product.reviews.forEach((reviews) => {
			if (reviews.user.toString() === reviews.user._id.toString()) {
				review.comment = comment;
				review.rating = rating;
			}
		});
	} else {
		product.reviews.push(review);
		product.numberOfReviews = product.reviews.length;
	}

	// adjust ratings
	product.ratings =
		product.reviews.reduce((acc, item) => item.rating + acc, 0) /
		product.reviews.reviews.lenght;

	await product.save({ validateBeforeSave: false });

	res.status(200).json({
		success: true,
	});
});

exports.deleteReview = BigPromise(async (req, res, next) => {
	const { productId } = req.query;

	const product = await Prodct.findById(productId);

	const reviews = product.reviews.filter(
		(rev) => rev.user.toString() === req.user._id.toString()
	);

	const numberOfReviews = reviews.lenght;

	// adjust ratings
	product.ratings =
		product.reviews.reduce((acc, item) => item.rating + acc, 0) /
		product.reviews.reviews.lenght;

	// update the product
	await Product.findByIdAndUpdate(
		productId,
		{
			reviews,
			ratings,
			numberOfReviews,
		},
		{
			new: true,
			runValidators: true,
			useFindAndModify: false,
		}
	);

	res.status(200).json({
		success: true,
	});
});

exports.getOnlyReviewsForOneProduct = BigPromise(async (req, res, next) => {
	const product = await Product.findById(req.query.id);

	res.status(200).json({
		seccess: true,
		reviews: product.reviews,
	});
});

// Admin only controllers
exports.adminGetAllProduct = BigPromise(async (req, res, next) => {
	console.log("adminGetAllProduct hit");

	const products = await Product.find();

	if (!products) {
		console.log("No products found in the database");
		return next(new CustomError("No product found!", 401));
	}

	console.log(`Found ${products.length} products`);
	res.status(200).json({
		success: true,
		products,
	});
});

exports.adminUpdateOneProduct = BigPromise(async (req, res, next) => {
	let product = await Product.findById(req.params.id);

	if (!product) {
		return next(new CustomError("No product found with this id!", 401));
	}

	let imagesArray = [];

	if (req.files) {
		// Brisanje postojećih slika s Cloudinary-a
		for (let index = 0; index < product.photos.length; index++) {
			await cloudinary.v2.uploader.destroy(product.photos[index].id);
		}

		// Upload novih slika
		for (let index = 0; index < req.files.photos.length; index++) {
			let result = await cloudinary.v2.uploader.upload(
				req.files.photos[index].tempFilePath,
				{ folder: "products" }
			);

			imagesArray.push({
				id: result.public_id,
				secure_url: result.secure_url,
			});
		}
	}

	// Ažuriranje podataka o proizvodu
	req.body.photos = imagesArray;

	product = await Product.findByIdAndUpdate(req.params.id, req.body, {
		new: true,
		runValidators: true,
		useFindAndModify: false,
	});

	res.status(200).json({
		success: true,
		product,
	});
});

exports.adminDeleteOneProduct = BigPromise(async (req, res, next) => {
	let product = await Product.findById(req.params.id);

	if (!product) {
		return next(new CustomError("No product found with this id!", 401));
	}

	// destroy existing images
	for (let index = 0; index < product.photos.length; index++) {
		const res = await cloudinary.v2.uploader.destroy(product.photos[index].id);
	}

	await Product.findByIdAndDelete(req.params.id);

	res.status(200).json({
		success: true,
		message: "Product was delleted!",
	});
});
