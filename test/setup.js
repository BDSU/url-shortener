const process = require("process");

process.on("unhandledRejection", (err) => {
	// eslint-disable-next-line no-console
	console.error(err);
});