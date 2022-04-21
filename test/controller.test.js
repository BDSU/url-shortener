jest.setTimeout(30000);

const process = require("process");
const appRoot = require("app-root-path");

// --------------------------------------------------------------------
// mock
// --------------------------------------------------------------------

// eslint-disable-next-line no-unused-vars
const mockExit = jest.spyOn(process, "exit").mockImplementation((_number) => {
	// console.log("called process.exit with " + _number);
});

/**
 * mock config by merging given object with actual config 
 * @param {*} mockOverrides json object
 */
function setupMockConfig(mockOverrides) {
	const _ = require("lodash");
	const originalConfig = jest.requireActual(require("app-root-path") + "/src/config/config.js");	
	const mockedData = _.merge(originalConfig, mockOverrides);	
	jest.doMock(appRoot + "/src/config/config.js", () => mockedData);
}

// --------------------------------------------------------------------
// test suite
// --------------------------------------------------------------------

describe("url-shortener - controller", () => {

	// --------------------------------------------------------------------
	// setup
	// --------------------------------------------------------------------

	const controllerInitTimeMS = 1500;

	// --------------------------------------------------------------------
	// tests
	// --------------------------------------------------------------------

	describe("gracefulexit", () => {

		// NOTE: Test gracefulexit event by providing an invalid config (mocked), although it would have been detected
		// due to the validation inside config.js. Currently, it seems like there is no other way to provoke a
		// gracefulexit event.

		test("server - listen (unable to listen)", async () => {
			setupMockConfig({
				server: {
					port: -1000
				}
			});

			// NOTE: It is necessary to import Controller in every test. Otherise Controller uses "old config mock" although the implementation was
			// already changed. This unwanted behavior does not affect the first test. However, it affects all following tests.
			const Controller = require(appRoot + "/src/api/controller.js");
			const tmpConfig = require(appRoot + "/src/config/config.js");

			expect(tmpConfig.server.port).toEqual(-1000);

			new Controller();
			await new Promise((res) => setTimeout(res, controllerInitTimeMS)); // NOTE: wait for initialization of controller
			
			expect(mockExit).toHaveBeenCalledWith(0);
		});

		test("server - listen (not created)", async () => {
			setupMockConfig({
				server: {
					ssl: {
						active: true,
						key: "invalidpath",
						cert: "invalidpath"
					}
				}
			});
			
			const Controller = require(appRoot + "/src/api/controller.js");
			const tmpConfig = require(appRoot + "/src/config/config.js");

			expect(tmpConfig.server.ssl.active).toEqual(true);
			expect(tmpConfig.server.ssl.key).toEqual("invalidpath");
			expect(tmpConfig.server.ssl.cert).toEqual("invalidpath");

			new Controller();
			await new Promise((res) => setTimeout(res, controllerInitTimeMS)); // NOTE: wait for initialization of controller
			
			expect(mockExit).toHaveBeenCalledWith(0);
		});

		test("datamanager - wrong port", async () => {
			setupMockConfig({
				mongo: {
					server: {
						port: 1000 // no mongodb instance listening on this port
					}
				}
			});

			const Controller = require(appRoot + "/src/api/controller.js");
			const tmpConfig = require(appRoot + "/src/config/config.js");
			
			expect(tmpConfig.mongo.server.port).toEqual(1000);

			new Controller();
			await new Promise((res) => setTimeout(res, controllerInitTimeMS)); // NOTE: wait for initialization of controller
			
			expect(mockExit).toHaveBeenCalledWith(0);
		});

		test("datamanager - invalid port", async () => {
			setupMockConfig({
				mongo: {
					server: {
						port: -2000
					}
				}
			});

			const Controller = require(appRoot + "/src/api/controller.js");
			const tmpConfig = require(appRoot + "/src/config/config.js");
			
			expect(tmpConfig.mongo.server.port).toEqual(-2000);

			new Controller();
			await new Promise((res) => setTimeout(res, controllerInitTimeMS)); // NOTE: wait for initialization of controller
			
			expect(mockExit).toHaveBeenCalledWith(0);
		});

		test("SIGINT", async () => {
			setupMockConfig({});

			const Controller = require(appRoot + "/src/api/controller.js");
			new Controller();
			await new Promise((res) => setTimeout(res, controllerInitTimeMS)); // NOTE: wait for initialization of controller

			process.emit("SIGINT");
			await new Promise((res) => setTimeout(res, 500)); // NOTE: wait for SIGINT

			expect(mockExit).toHaveBeenCalledWith(0);
		});

		test("SIGTERM", async () => {
			setupMockConfig({});

			const Controller = require(appRoot + "/src/api/controller.js");
			new Controller();
			await new Promise((res) => setTimeout(res, controllerInitTimeMS)); // NOTE: wait for initialization of controller

			process.emit("SIGTERM");
			await new Promise((res) => setTimeout(res, 500)); // NOTE: wait for SIGTERM

			expect(mockExit).toHaveBeenCalledWith(0);
		});

		afterEach(async () => {
			jest.resetModules();
		});

	});

});