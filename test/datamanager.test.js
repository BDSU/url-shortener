jest.setTimeout(30000);

const { v4: uuidv4 } = require("uuid");
const _ = require("lodash");

const DataManager = require("../src/persistence/instance.js");
const CONFIG = require("../src/config/config.js");

const {
	expectEntryFromDatamanager
} = require("./helper/expectfn.js");


// --------------------------------------------------------------------
// setup
// --------------------------------------------------------------------

var datamanager = new DataManager(CONFIG.mongo).getInstance();

// --------------------------------------------------------------------
// test suite
// --------------------------------------------------------------------

describe("url-shortener - datamanager", () => {

	// --------------------------------------------------------------------
	// tests
	// --------------------------------------------------------------------

	describe("check database access", () => {
		test("check failed", async () => {
			var config = _.cloneDeep(CONFIG);
			config.mongo.server.database = "nonexistingdatabase";

			datamanager = new DataManager(config.mongo).getInstance();
			await datamanager.connect();

			try {
				await datamanager.check();
			} catch(error) {
				expect(error).toBeDefined();
			}

			await datamanager.close();
		});

		test("successfully checked", async () => {
			const config = _.cloneDeep(CONFIG);
			datamanager = new DataManager(config.mongo).getInstance();
			await datamanager.connect();

			const res = await datamanager.check();
			await datamanager.close();
			expect(res).toBeUndefined();
		});
	});

	describe("hanlde expired entries", () => {
		var keys = [];

		beforeAll(async () => {
			datamanager = new DataManager(CONFIG.mongo).getInstance();
			await datamanager.connect();

			try {
				const newKey = await datamanager.createKey();

				expect(newKey).toBeDefined();
				expect(typeof newKey === "string").toBeTruthy();
				expect(newKey.length > 0).toBeTruthy();

				await datamanager.addEntry({
					key: newKey,
					oid: uuidv4(),
					longurl: "https://google.com",
					persistent: false
				});
			} catch(error) {
				// eslint-disable-next-line no-console
				console.error(error);
			}
		});

		test("findExpiredEntries", async () => {
			const maxAgeMinutes = 0;
			try {
				const entries = await datamanager.findExpiredEntries(maxAgeMinutes);
				
				expect(entries).toBeDefined();
				expect(Array.isArray(entries)).toBeTruthy();
				for(var i = 0; i < entries.length; i++) {
					expectEntryFromDatamanager(entries[i]);
					keys.push(entries[i].key);
				}
			} catch(error) {
				// eslint-disable-next-line no-console
				console.error(error);
			}
		});

		test("findExpiredEntries - negative maxAge", async () => {
			const maxAgeMinutes = -1000;
			try {
				const entries = await datamanager.findExpiredEntries(maxAgeMinutes);
				
				expect(entries).toBeDefined();
				expect(Array.isArray(entries)).toBeTruthy();
				for(var i = 0; i < entries.length; i++) {
					expectEntryFromDatamanager(entries[i]);
				}
			} catch(error) {
				// eslint-disable-next-line no-console
				console.error(error);
			}
		});

		test("findExpiredEntries - number as string", async () => {
			const maxAgeMinutes = "3600";
			try {
				const entries = await datamanager.findExpiredEntries(maxAgeMinutes);
				
				expect(entries).toBeDefined();
				expect(Array.isArray(entries)).toBeTruthy();
				for(var i = 0; i < entries.length; i++) {
					expectEntryFromDatamanager(entries[i]);
				}
			} catch(error) {
				// eslint-disable-next-line no-console
				console.error(error);
			}
		});

		test("deleteExpiredEntries", async () => {
			try {
				const result = await datamanager.deleteExpiredEntries(keys);

				expect(result).toBeDefined();
				expect(result.deletedCount).toBeDefined();
				expect(typeof result.deletedCount === "number").toBeTruthy();
				expect(result.deletedCount >= 0).toBeTruthy();
			} catch(error) {
				// eslint-disable-next-line no-console
				console.error(error);
			}
		});

		test("deleteExpiredEntries - empty", async () => {
			try {
				const result = await datamanager.deleteExpiredEntries([]);

				expect(result).toBeDefined();
				expect(result.deletedCount).toBeDefined();
				expect(typeof result.deletedCount === "number").toBeTruthy();
				expect(result.deletedCount == 0).toBeTruthy();
			} catch(error) {
				// eslint-disable-next-line no-console
				console.error(error);
			}
		});

		test("deleteExpiredEntries - invalid keys", async () => {
			try {
				const result = await datamanager.deleteExpiredEntries([
					"testkey124091824124",
					"testkey124191824124"
				]);

				expect(result).toBeDefined();
				expect(result.deletedCount).toBeDefined();
				expect(typeof result.deletedCount === "number").toBeTruthy();
				expect(result.deletedCount == 0).toBeTruthy();
			} catch(error) {
				// eslint-disable-next-line no-console
				console.error(error);
			}
		});

		test("deleteCallsOfExpiredEntries", async () => {
			try {
				const result = await datamanager.deleteCallsOfExpiredEntries(keys);

				expect(result).toBeDefined();
				expect(result.deletedCount).toBeDefined();
				expect(typeof result.deletedCount === "number").toBeTruthy();
				expect(result.deletedCount >= 0).toBeTruthy();

			} catch(error) {
				// eslint-disable-next-line no-console
				console.error(error);
			}
		});

		test("deleteCallsOfExpiredEntries - empty", async () => {
			try {
				const result = await datamanager.deleteCallsOfExpiredEntries([]);

				expect(result).toBeDefined();
				expect(result.deletedCount).toBeDefined();
				expect(typeof result.deletedCount === "number").toBeTruthy();
				expect(result.deletedCount == 0).toBeTruthy();

			} catch(error) {
				// eslint-disable-next-line no-console
				console.error(error);
			}
		});

		test("deleteCallsOfExpiredEntries - invalid keys", async () => {
			try {
				const result = await datamanager.deleteCallsOfExpiredEntries([
					"testkey124091824124",
					"testkey124191824124"
				]);

				expect(result).toBeDefined();
				expect(result.deletedCount).toBeDefined();
				expect(typeof result.deletedCount === "number").toBeTruthy();
				expect(result.deletedCount == 0).toBeTruthy();

			} catch(error) {
				// eslint-disable-next-line no-console
				console.error(error);
			}
		});
	});

	describe("handle errors", () => {
		test("drop - not connected", async () => {
			datamanager = new DataManager(CONFIG.mongo).getInstance();
			await datamanager.connect();

			// --------------------------------------------------------------------
			// mock
			// --------------------------------------------------------------------
			const spyFn = jest.spyOn(datamanager, "drop").mockImplementation(() => {
				const msg = "not connected. unable to drop database " + datamanager.opts.server.database;
				return Promise.reject(msg);
			});

			try {
				await datamanager.drop().then(() => {
					expect(false).toBeTruthy();
				});
			} catch(error) {
				expect(spyFn).toHaveBeenCalled();
				expect(typeof error === "string").toBeTruthy();
				expect(error === ("not connected. unable to drop database " + datamanager.opts.server.database)).toBeTruthy();
			}
		});

		test("drop - failed", async () => {
			datamanager = new DataManager(CONFIG.mongo).getInstance();
			await datamanager.connect();

			// --------------------------------------------------------------------
			// mock
			// --------------------------------------------------------------------
			const spyFn = jest.spyOn(datamanager, "drop").mockImplementation(() => {
				const msg = "failed to drop database " + datamanager.opts.server.database + ": " + false;
				return Promise.reject(msg);
			});

			try {
				await datamanager.drop().then(() => {
					expect(false).toBeTruthy();
				});
			} catch(error) {
				expect(spyFn).toHaveBeenCalled();
				expect(typeof error === "string").toBeTruthy();
				expect(error === ("failed to drop database " + datamanager.opts.server.database + ": " + false)).toBeTruthy();
			}
		});


	});

	// --------------------------------------------------------------------
	// tear down
	// --------------------------------------------------------------------

	afterAll(async () => {
		await datamanager.drop().catch(() => {});
		await datamanager.close();
	});

});