const nodemailer = require("nodemailer");

const mailHelper = async (option) => {
	try {
		const transporter = nodemailer.createTransport({
			host: process.env.SMTP_HOST,
			port: parseInt(process.env.SMTP_PORT, 10) || 2525, // Zadani port
			auth: {
				user: process.env.SMTP_USER,
				pass: process.env.SMTP_PASS,
			},
		});

		const message = {
			from: "arneo.marinvincetic@gmail.com", // Sender address
			to: option.email, // Receiver email
			subject: option.subject, // Subject line
			text: option.message, // Plain text body
		};

		// Slanje e-maila
		const info = await transporter.sendMail(message);

		console.log("Email sent: %s", info.messageId);
	} catch (error) {
		console.error("Error sending email:", error.message);
		throw error; // Propagirati grešku za vanjske funkcije
	}
};

module.exports = mailHelper;
