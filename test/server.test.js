jest.setTimeout(30000);

const { fail } = require("assert");
const appRoot = require("app-root-path");

const Router = require(appRoot + "/src/api/router.js");
const Server = require(appRoot + "/src/api/server.js");
const CONFIG = require(appRoot + "/src/config/config.js");
const DataManager = require(appRoot + "/src/persistence/instance.js");

// --------------------------------------------------------------------
// helper
// --------------------------------------------------------------------

function getServerSettings(port, ssl, key, cert) {
	return {
		ssl: ssl,
		key: key,
		cert: cert,
		port: port
	};
}

// --------------------------------------------------------------------
// test suite
// --------------------------------------------------------------------

describe("url-shortener - server", () => {

	// --------------------------------------------------------------------
	// setup
	// --------------------------------------------------------------------

	const MANAGER_SETTINGS = CONFIG.mongo;
	var datamanager, router;
	
	beforeAll(async () => {
		datamanager = new DataManager(MANAGER_SETTINGS).getInstance();
		router = new Router(datamanager);
	});

	// --------------------------------------------------------------------
	// tests
	// --------------------------------------------------------------------

	describe("invalid port", () => {

		var server;

		test("port=-11341", async () => {
			server = new Server(router.getAppRouter(), getServerSettings(
				-11341, false, "", ""
			));
			server.on("gracefulexit", (err) => {
				expect(err).toBeDefined();
			});
			const success = server.listen();
			expect(success).toBeFalsy();
		});

		test("port=-2", async () => {
			server = new Server(router.getAppRouter(), getServerSettings(
				-2, false, "", ""
			));
			server.on("gracefulexit", (err) => {
				expect(err).toBeDefined();
			});
			const success = server.listen();
			expect(success).toBeFalsy();
		});

		test("port=abc", async () => {
			server = new Server(router.getAppRouter(), getServerSettings(
				"abc", false, "", ""
			));
			server.on("gracefulexit", (err) => {
				expect(err).toBeDefined();
			});
			const success = server.listen();
			expect(success).toBeFalsy();
		});

		test("port=390000000", async () => {
			server = new Server(router.getAppRouter(), getServerSettings(
				390000000, false, "", ""
			));
			server.on("gracefulexit", (err) => {
				expect(err).toBeDefined();
			});
			const success = server.listen();
			expect(success).toBeFalsy();
		});

		afterEach(async () => {
			// eslint-disable-next-line no-unused-vars
			server.close((_err) => {});
		});

	});

	describe("invalid path to key / cert", () => {
		
		var server;

		test("key file not found", async () => {
			server = new Server(router.getAppRouter(), getServerSettings(
				3800, true, appRoot + "/test/ssl/unknownprivkey.pem", appRoot + "/test/ssl/cert.pem"
			));
			server.on("gracefulexit", (err) => {
				expect(err).toBeDefined();
			});
			const success = server.listen();
			expect(success).toBeFalsy();
		});

		test("cert file not found", async () => {
			server = new Server(router.getAppRouter(), getServerSettings(
				3800, true, appRoot + "/test/ssl/privkey.pem", appRoot + "/test/ssl/unknowncert.pem"
			));
			server.on("gracefulexit", (err) => {
				expect(err).toBeDefined();
			});
			const success = server.listen();
			expect(success).toBeFalsy();
		});

		afterEach(async () => {
			// eslint-disable-next-line no-unused-vars
			server.close((_err) => {});
		});

	});

	describe("valid options", () => {
		
		var server;

		test("ssl=false", async () => {
			server = new Server(router.getAppRouter(), getServerSettings(
				3800, false, "", ""
			));
			// eslint-disable-next-line no-unused-vars
			server.on("gracefulexit", (_err) => {
				fail("error should not occur");
			});
			const success = server.listen();
			expect(success).toBeTruthy();
		});

		test("ssl=true", async () => {
			server = new Server(router.getAppRouter(), getServerSettings(
				3800, true, appRoot + "/test/ssl/privkey.pem", appRoot + "/test/ssl/cert.pem"
			));
			// eslint-disable-next-line no-unused-vars
			server.on("gracefulexit", (_err) => {
				fail("error should not occur");
			});
			const success = server.listen();
			expect(success).toBeTruthy();
		});

		afterEach(async () => {
			server.close((err) => {
				if(err) {
					// eslint-disable-next-line no-console
					console.log(err);
				}
			});
		});

	});
	
});