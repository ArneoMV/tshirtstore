// Importamo middleware koji osigurava upravljanje asinkronim funkcijama
const BigPromise = require("../middlewares/bigPromise");

// Glavna ruta za 'home' endpoint, koristeći BigPromise za automatsko hvatanje pogrešaka
exports.home = BigPromise(async (req, res) => {
	// Ovdje možete povezati bazu podataka ili izvršiti neku logiku prije slanja odgovora
	// const db = await something()

	// Vraćamo uspješan odgovor sa statusom 200 i porukom
	res.status(200).json({
		success: true,
		greeting: "Hello from API",
	});
});

// Funkcija 'homeDummy'
exports.homeDummy = async (req, res) => {
	res.status(200).json({
		success: true,
		greeting: "This is dummy route",
	});
};

/*
Drugi način implementacije iste funkcionalnosti bez korištenja BigPromise middleware-a.
Ovaj pristup ručno upravlja asinkronim operacijama i hvatanjem pogrešaka koristeći `try-catch`.

exports.homeDummy = async (req, res) => {
	// Ovdje biste mogli izvršiti asinkronu logiku, npr. dohvaćanje iz baze podataka
	// const db = await something()
	try {
		// Uspješan odgovor
		res.status(200).json({
			success: true,
			greeting: "this is another dummy route",
		});
	} catch (error) {
		// Ako dođe do pogreške, ispisuje se u konzolu
		console.log(error);
		// Opcionalno: može se poslati odgovor s greškom klijentu
		res.status(500).json({
			success: false,
			message: "Something went wrong",
		});
	}
};
*/

// Ručno upravljanje try-catch blokovima može postati nepregledno ako ima mnogo ruta.
// Zato je BigPromise middleware koristan jer pojednostavljuje upravljanje pogreškama i čini kod čišćim.
