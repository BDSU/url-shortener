jest.setTimeout(30000);

const process = require("process");
const fs = require("fs");
const { fail } = require("assert");

// --------------------------------------------------------------------
// mock
// --------------------------------------------------------------------

// process.exit is called if config cannot be parsed
const mockExit = jest.spyOn(process, "exit").mockImplementation(() => {});

// --------------------------------------------------------------------
// test suite
// --------------------------------------------------------------------

describe("url-shortener - config", () => {

	// --------------------------------------------------------------------
	// tests
	// --------------------------------------------------------------------

	describe("env file", () => {
		const original = "./src/config/.app.env";
		const temporary = "./src/config/.app.env.bak";

		test("file not found", () => {
			fs.renameSync(original, temporary);
			var CONFIG;
			try {
				CONFIG = require("../src/config/config.js");
				fail("config file should not have been parsed");
			} catch(error) {
				expect(mockExit).toHaveBeenCalledWith(1);
				expect(CONFIG).toBeUndefined();
			}
		});

		test("parse file successfully", () => {
			fs.renameSync(temporary, original);
			try {
				const CONFIG = require("../src/config/config.js");
				expect(CONFIG).toBeDefined();
			} catch(error) {
				fail("config file should have been parsed successfully");
			}
		});
	});

});