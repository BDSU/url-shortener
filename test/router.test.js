jest.setTimeout(30000);

const request = require("supertest");
const appRoot = require("app-root-path");

const {
	expectInternalServerError
} = require("./helper/expectfn.js");

const Router = require(appRoot + "/src/api/router.js");
const CONFIG = require(appRoot + "/src/config/config.js");
const DataManager = require(appRoot + "/src/persistence/instance.js");

// --------------------------------------------------------------------
// test suite
// --------------------------------------------------------------------

describe("url-shortener - router", () => {

	// --------------------------------------------------------------------
	// setup
	// --------------------------------------------------------------------

	const MANAGER_SETTINGS = CONFIG.mongo;
	var datamanager, router;
	
	beforeAll(async () => {
		// NOTE: provoke error by not explicitly connecting to database
		datamanager = new DataManager(MANAGER_SETTINGS).getInstance();
		router = new Router(datamanager);
	});

	describe("gracefulexit", () => {

		test("unspecified error", async () => {
			const app = router.getAppRouter();
			router.on("gracefulexit", (err) => {
				expect(err).toBeDefined();
			});
			
			const res = await request(app)
				.get("/key981274")
				.send();

			expectInternalServerError(res);
		});

	});

	// --------------------------------------------------------------------
	// tear down
	// --------------------------------------------------------------------

	afterAll(async () => {
		datamanager.close();
		router = undefined;
	});

});