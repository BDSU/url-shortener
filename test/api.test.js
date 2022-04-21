jest.setTimeout(30000);

const request = require("supertest");
const { v4: uuidv4 } = require("uuid");

const {
	api,
	expectNoContent,
	expectRedirect,
	expectBadRequestValidation,
	expectUnauthorized,
	expectForbidden,
	expectNotFound
} = require("./helper/expectfn.js");
const {
	expectAllKeys,
	expectInfo,
	expectStats,
	expectCreated,
	expectUpdated
} = api;
const {
	authenticate,
	identify
} = require("../src/api/middleware/auth.js");

const Router = require("../src/api/router.js");
const DataManager = require("../src/persistence/instance.js");
const CONFIG = require("../src/config/config.js");


// --------------------------------------------------------------------
// mock
// --------------------------------------------------------------------

// mock only function 'authenticate' and 'identify'
jest.mock("../src/api/middleware/auth.js", () => {
	const original = jest.requireActual("../src/api/middleware/auth.js");
	return {
		...original,
		authenticate: jest.fn(),
		identify: jest.fn()
	};
});
authenticate.mockImplementation((req, _res, next) => {
	const debug = require("debug")("url-shortener:test:middleware:auth");
	debug("authenticate ...");
	const token = req.cookies["aad-token"];
	req.decoded = {
		"oid": undefined, // o365 user id: 14270897-427a-44d8-9700-1a6d0b3de759
		"admin": false,
		"token": token, // original token
		"decoded": undefined // decoded token
	};

	switch(token) {
	case "valid-admin":
		debug("authenticated: admin");
		req.decoded.oid = "c1916b4f-7269-4dda-b281-e688d731c13f";
		req.decoded.admin = true;
		next();
		break;
	case "valid-user":
		debug("authenticated: user");
		req.decoded.oid = "78f296ea-b629-49e6-9756-414c4565bcbe";
		next();
		break;
	case "other-valid-user":
		debug("authenticated: user");
		req.decoded.oid = "71747c0b-506a-45cf-bb50-e5ddca9e855d";
		next();
		break;
	case "":
		debug("authentication failed: missing token (empty)");
		next({
			code: 401,
			message: "unauthorized"
		});
		break;
	case undefined:
		debug("authentication failed: missing token (undefined)");
		next({
			code: 401,
			message: "unauthorized"
		});
		break;
	default:
		debug("authentication failed: invalid token");
		next({
			code: 403,
			message: "forbidden"
		});
		break;
	}
});
identify.mockImplementation((req, res, next) => {
	const debug = require("debug")("url-shortener:test:middleware:auth");
	debug("identify user ...");
	const token = req.cookies["aad-token"];
	const anonId = req.cookies["anon-id"];

	if(!req.decoded || !req.decoded.oid) {
		var tmpId = null;

		switch(token) {
		case "valid-admin":
			debug("identified: admin");
			tmpId = "c1916b4f-7269-4dda-b281-e688d731c13f";
			break;
		case "valid-user":
			debug("identified: user");
			tmpId = "78f296ea-b629-49e6-9756-414c4565bcbe";
			break;
		case "other-valid-user":
			debug("identified: user");
			tmpId = "71747c0b-506a-45cf-bb50-e5ddca9e855d";
			break;
		default:
			debug("authentication failed: invalid token");
			if(!anonId) {
				debug("no token and no anonymous id. creating new id ...");
				tmpId = uuidv4();
			} else {
				debug("existing anonymous id found");
				tmpId = anonId;
			}
			break;
		}
	
		req.decoded = {
			oid: tmpId
		};
	
		// expires in 10 years (never)
		debug("set cookie 'anon-id'");
		res.cookie("anon-id", req.decoded.oid, {
			maxAge: 1000 * 60 * 60 * 24 * 365 * 10
		});
	}

	debug("user identified as " + req.decoded.oid);
	next();
});

// --------------------------------------------------------------------
// test suite
// --------------------------------------------------------------------

describe("url-shortener - business logic", () => {

	// --------------------------------------------------------------------
	// setup
	// --------------------------------------------------------------------

	var datamanager = new DataManager(CONFIG.mongo).getInstance();
	var app = new Router(datamanager).getAppRouter();

	var urls = {
		simple: null,
		simpleKey: null,
		persistent0: null,
		persistent1: null
	};

	// connect to database before running tests
	beforeAll(async () => {
		await datamanager.connect();
	});

	// --------------------------------------------------------------------
	// test data
	// --------------------------------------------------------------------

	const dataKey = [
		-99,
		-1,
		0,
		1,
		123,
		100000,
		"",
		"i",
		"90nucsacoiudnhsax",
		"?32$2",
		true,
		false,
		{},
		[]
	];
	const dataLongurl = [
		-99,
		-1,
		0,
		1,
		123,
		100000,
		"",
		"inval",
		true,
		false,
		{},
		[],
		"0ß1293",
		"invalidurl",
		"a.b",
		"google.c",
		"httpsinvalid://google.com"
	];
	const dataPersistence = [
		-99,
		-1,
		123,
		100000,
		"",
		"inval",
		{},
		[],
		"0ß1293",
		"invalidurl",
		"a.b",
		"google.c",
		"httpsinvalid://google.com"
	];

	const dataKeyParam = [
		-99,
		-1,
		0,
		1,
		123,
		100000,
		"i",
		"90nucsacoiudnhsax",
		"3?2$2",
		true,
		false,
		{}
	];

	// --------------------------------------------------------------------
	// tests
	// --------------------------------------------------------------------

	describe("GET\t/", () => {
		test("invalid request empty", async () => {
			const res = await request(app)
				.get("/")
				.send();
				
			expect(authenticate).toHaveBeenCalled();
			expectUnauthorized(res);
		});

		test("valid request with token", async () => {
			const res = await request(app)
				.get("/")
				.set("Cookie", ["aad-token=valid-user"])
				.send();
				
			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectAllKeys(res);
		});

		test("invalid request with invalid token", async () => {
			const res = await request(app)
				.get("/")
				.set("Cookie", ["aad-token=xyz"])
				.send();
				
			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectForbidden(res);
		});

		test("invalid request with anon-id", async () => {
			const res = await request(app)
				.get("/")
				.set("Cookie", ["anon-id=" + uuidv4()])
				.send();
				
			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectUnauthorized(res);
		});

		test("valid request with token and anon-id", async () => {
			const res = await request(app)
				.get("/")
				.set("Cookie", ["aad-token=valid-user", "anon-id=" + uuidv4()])
				.send();
				
			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectAllKeys(res);
		});

	});

	describe("POST\t/", () => {

		// --------------------
		// helper functions
		// --------------------

		const testUrl = function(url) {
			test("invalid request with property type url (" + typeof url + ")", async () => {
				const res = await request(app)
					.post("/")
					.set("Cookie", ["aad-token=valid-user"])
					.send({
						"longurl": url
					});
				
				expect(authenticate).toHaveBeenCalled();
				expect(identify).toHaveBeenCalled();
				expectBadRequestValidation(res);
			});
		};

		const testPersistence = function(pers) {
			test("invalid request with property type persistent (" + typeof pers + ")", async () => {
				const res = await request(app)
					.post("/")
					.set("Cookie", ["aad-token=valid-user"])
					.send({
						"longurl": "https://www.google.com",
						"persistent": pers
					});
				
				expect(authenticate).toHaveBeenCalled();
				expect(identify).toHaveBeenCalled();
				expectBadRequestValidation(res);
			});
		};

		const testKey = function(key) {
			test("invalid request with property type key (" + typeof key + ")", async () => {
				const res = await request(app)
					.post("/")
					.set("Cookie", ["aad-token=valid-user"])
					.send({
						"key": key,
						"longurl": "https://google.com"
					});

				expect(authenticate).toHaveBeenCalled();
				expect(identify).toHaveBeenCalled();
				expectBadRequestValidation(res);
			});
		};

		// --------------------
		// tests
		// --------------------

		test("valid request (simple)", async () => {
			const res = await request(app)
				.post("/")
				.set("Cookie", ["aad-token=valid-user"])
				.send({
					"longurl": "https://www.google.com"
				});
			
			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectCreated(res);
			urls.simple = res.body;
		});

		test("valid request (simple) without token", async () => {
			const res = await request(app)
				.post("/")
				.send({
					"longurl": "https://www.google.com"
				});
			
			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectUnauthorized(res);
		});

		test("valid request (simple) with invalid token", async () => {
			const res = await request(app)
				.post("/")
				.set("Cookie", ["aad-token=invalid"])
				.send({
					"longurl": "https://www.google.com"
				});
			
			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectForbidden(res);
		});

		test("valid request (simpleKey) with key", async () => {
			const res = await request(app)
				.post("/")
				.set("Cookie", ["aad-token=valid-user"])
				.send({
					"key": "testkey",
					"longurl": "https://www.google.com"
				});
			
			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectCreated(res);
			urls.simpleKey = res.body;
		});

		test("valid request (simpleKey) with min. length key", async () => {
			const res = await request(app)
				.post("/")
				.set("Cookie", ["aad-token=valid-user"])
				.send({
					"key": "ab",
					"longurl": "https://www.google.com"
				});
			
			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectCreated(res);
			urls.simpleKey = res.body;
		});

		test("valid request (simpleKey) with max. length key", async () => {
			const res = await request(app)
				.post("/")
				.set("Cookie", ["aad-token=valid-user"])
				.send({
					"key": "abcdefghijklmnop",
					"longurl": "https://www.google.com"
				});
			
			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectCreated(res);
			urls.simpleKey = res.body;
		});
		
		test("valid request (persistent0) with persistent false", async () => {
			const res = await request(app)
				.post("/")
				.set("Cookie", ["aad-token=valid-user"])
				.send({
					"longurl": "https://www.google.com",
					"persistent": true
				});
			
			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectCreated(res);
			urls.persistent0 = res.body;
		});

		test("valid request (persistent1) with persistent true", async () => {
			const res = await request(app)
				.post("/")
				.set("Cookie", ["aad-token=valid-user"])
				.send({
					"longurl": "https://www.google.com",
					"persistent": true
				});

			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectCreated(res);
			urls.persistent1 = res.body;
		});

		test("invalid request: misspelled property longurl", async () => {
			const res = await request(app)
				.post("/")
				.set("Cookie", ["aad-token=valid-user"])
				.send({
					"longurl2": "https://www.google.com"
				});

			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectBadRequestValidation(res);
		});

		test("invalid request: empty body", async () => {
			const res = await request(app)
				.post("/")
				.set("Cookie", ["aad-token=valid-user"])
				.send({});

			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectBadRequestValidation(res);
		});


		for(var i = 0; i < dataLongurl.length; i++) {
			testUrl(dataLongurl[i]);
		}
		for(i = 0; i < dataKey.length; i++) {
			testKey(dataKey[i]);
		}
		for(i = 0; i < dataPersistence.length; i++) {
			testPersistence(dataPersistence[i]);
		}

	});

	describe("PUT\t/:key", () => {

		// --------------------
		// helper functions
		// --------------------

		const testUrl = function(url) {
			test("invalid request with property type url (" + typeof url + ")", async () => {
				const res = await request(app)
					.put("/" + urls.simple.key)
					.set("Cookie", ["aad-token=valid-user"])
					.send({
						"longurl": url
					});
				
				expect(authenticate).toHaveBeenCalled();
				expect(identify).toHaveBeenCalled();
				expectBadRequestValidation(res);
			});
		};

		const testPersistence = function(pers) {
			test("invalid request with property type persistent (" + typeof pers + ")", async () => {
				const res = await request(app)
					.put("/" + urls.simple.key)
					.set("Cookie", ["aad-token=valid-user"])
					.send({
						"longurl": "https://www.facebook.com",
						"persistent": pers
					});
				
				expect(authenticate).toHaveBeenCalled();
				expect(identify).toHaveBeenCalled();
				expectBadRequestValidation(res);
			});
		};

		// --------------------
		// tests
		// --------------------

		test("valid request (simple)", async () => {
			const res = await request(app)
				.put("/" + urls.simple.key)
				.set("Cookie", ["aad-token=valid-user"])
				.send({
					"longurl": "https://www.facebook.com"
				});

			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectUpdated(res);
		});

		test("valid request (simple) without token", async () => {
			const res = await request(app)
				.put("/" + urls.simple.key)
				.send({
					"longurl": "https://www.facebook.com"
				});
			
			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectUnauthorized(res);
		});

		test("valid request (simple) with invalid token", async () => {
			const res = await request(app)
				.put("/" + urls.simple.key)
				.set("Cookie", ["aad-token=invalid"])
				.send({
					"longurl": "https://www.facebook.com"
				});
			
			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectForbidden(res);
		});

		test("valid request (simple) with valid token from another user", async () => {
			const res = await request(app)
				.put("/" + urls.simple.key)
				.set("Cookie", ["aad-token=other-valid-user"])
				.send({
					"longurl": "https://www.facebook.com"
				});
			
			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectForbidden(res);
		});

		test("invalid request: not found", async () => {
			const res = await request(app)
				.put("/unknown")
				.set("Cookie", ["aad-token=valid-user"])
				.send({
					"longurl": "https://www.facebook.com"
				});

			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectNotFound(res);
		});

		test("valid request (simple) with persistent true", async () => {
			const res = await request(app)
				.put("/" + urls.simple.key)
				.set("Cookie", ["aad-token=valid-user"])
				.send({
					"persistent": true
				});

			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectUpdated(res);
		});

		test("valid request (simple) with persistent false", async () => {
			const res = await request(app)
				.put("/" + urls.simple.key)
				.set("Cookie", ["aad-token=valid-user"])
				.send({
					"persistent": false
				});

			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectUpdated(res);
		});

		test("valid request (simpleKey) from admin", async () => {
			const res = await request(app)
				.put("/" + urls.simpleKey.key)
				.set("Cookie", ["aad-token=valid-admin"])
				.send({
					"longurl": "https://www.stackoverflow.com",
					"persistent": false
				});
			
			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectUpdated(res);
		});

		for(var i = 0; i < dataLongurl.length; i++) {
			testUrl(dataLongurl[i]);
		}
		for(i = 0; i < dataPersistence.length; i++) {
			testPersistence(dataPersistence[i]);
		}
		
	});

	describe("GET\t/:key", () => {
		// --------------------
		// helper functions
		// --------------------

		const testKey = function(key) {
			test("invalid request with key (" + typeof key + ")", async () => {
				const res = await request(app)
					.get("/" + String(key))
					.set("Cookie", ["aad-token=valid-user"])
					.send();
				
				expect(authenticate).toHaveBeenCalled();
				expect(identify).toHaveBeenCalled();
				expectNotFound(res);
			});
		};

		// --------------------
		// tests
		// --------------------

		test("valid request (simple) empty: endpoint not found", async () => {
			const res = await request(app)
				.get("/" + urls.simple.key + "/unknownendpoint")
				.send();
				
			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectNotFound(res);
		});

		test("valid request (simple) empty", async () => {
			const res = await request(app)
				.get("/" + urls.simple.key)
				.send();
				
			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectRedirect(res);
		});

		test("valid request (simple) with token", async () => {
			const res = await request(app)
				.get("/" + urls.simple.key)
				.set("Cookie", ["aad-token=valid-user"])
				.send();
				
			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectRedirect(res);
		});

		test("valid request (simple) with anon-id", async () => {
			const res = await request(app)
				.get("/" + urls.simple.key)
				.set("Cookie", ["anon-id=" + uuidv4()])
				.send();
				
			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectRedirect(res);
		});

		test("valid request (simple) with token and anon-id", async () => {
			const res = await request(app)
				.get("/" + urls.simple.key)
				.set("Cookie", ["aad-token=valid-user", "anon-id=" + uuidv4()])
				.send();
				
			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectRedirect(res);
		});

		test("invalid request: not found", async () => {
			const res = await request(app)
				.get("/unknown")
				.set("Cookie", ["aad-token=other-valid-user", "anon-id=" + uuidv4()])
				.send();
				
			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectNotFound(res);
		});

		for(var i = 0; i < dataKeyParam.length; i++) {
			testKey(dataKeyParam[i]);
		}

	});

	describe("GET\t/:key/info", () => {
		// --------------------
		// helper functions
		// --------------------

		const testKey = function(key) {
			test("invalid request with key (" + typeof key + ")", async () => {
				const res = await request(app)
					.get("/" + String(key) + "/info")
					.set("Cookie", ["aad-token=valid-user"])
					.send();
				
				expect(authenticate).toHaveBeenCalled();
				expect(identify).toHaveBeenCalled();
				expectNotFound(res);
			});
		};

		// --------------------
		// tests
		// --------------------

		test("invalid request (simple) empty", async () => {
			const res = await request(app)
				.get("/" + urls.simple.key + "/info")
				.send();
				
			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectUnauthorized(res);
		});

		test("valid request (simple) with token", async () => {
			const res = await request(app)
				.get("/" + urls.simple.key + "/info")
				.set("Cookie", ["aad-token=valid-user"])
				.send();
				
			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectInfo(res);
		});

		test("invalid request (simple) with intoken", async () => {
			const res = await request(app)
				.get("/" + urls.simple.key + "/info")
				.set("Cookie", ["aad-token=xyz"])
				.send();
				
			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectForbidden(res);
		});

		test("valid request (simple) with anon-id", async () => {
			const res = await request(app)
				.get("/" + urls.simple.key + "/info")
				.set("Cookie", ["anon-id=" + uuidv4()])
				.send();
				
			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectUnauthorized(res);
		});

		test("valid request (simple) with token and anon-id", async () => {
			const res = await request(app)
				.get("/" + urls.simple.key + "/info")
				.set("Cookie", ["aad-token=valid-user", "anon-id=" + uuidv4()])
				.send();
				
			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectInfo(res);
		});

		test("invalid request: not found", async () => {
			const res = await request(app)
				.get("/unknown/info")
				.set("Cookie", ["aad-token=other-valid-user", "anon-id=" + uuidv4()])
				.send();
				
			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectNotFound(res);
		});

		for(var i = 0; i < dataKeyParam.length; i++) {
			testKey(dataKeyParam[i]);
		}
	});

	describe("GET\t/:key/stats", () => {
		// --------------------
		// helper functions
		// --------------------

		const testKey = function(key) {
			test("invalid request with key (" + typeof key + ")", async () => {
				const res = await request(app)
					.get("/" + String(key) + "/stats")
					.set("Cookie", ["aad-token=valid-user"])
					.send();
				
				expect(authenticate).toHaveBeenCalled();
				expect(identify).toHaveBeenCalled();
				expectNotFound(res);
			});
		};

		// --------------------
		// tests
		// --------------------

		test("invalid request (simple) empty", async () => {
			const res = await request(app)
				.get("/" + urls.simple.key + "/stats")
				.send();
				
			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectUnauthorized(res);
		});

		test("valid request (simple) with token", async () => {
			const res = await request(app)
				.get("/" + urls.simple.key + "/stats")
				.set("Cookie", ["aad-token=valid-user"])
				.send();
				
			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectStats(res);
		});

		test("invalid request (simple) with intoken", async () => {
			const res = await request(app)
				.get("/" + urls.simple.key + "/stats")
				.set("Cookie", ["aad-token=xyz"])
				.send();
				
			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectForbidden(res);
		});

		test("valid request (simple) with anon-id", async () => {
			const res = await request(app)
				.get("/" + urls.simple.key + "/stats")
				.set("Cookie", ["anon-id=" + uuidv4()])
				.send();
				
			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectUnauthorized(res);
		});

		test("valid request (simple) with token and anon-id", async () => {
			const res = await request(app)
				.get("/" + urls.simple.key + "/stats")
				.set("Cookie", ["aad-token=valid-user", "anon-id=" + uuidv4()])
				.send();
				
			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectStats(res);
		});

		test("invalid request: not found", async () => {
			const res = await request(app)
				.get("/unknown/stats")
				.set("Cookie", ["aad-token=other-valid-user", "anon-id=" + uuidv4()])
				.send();
				
			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectNotFound(res);
		});

		for(var i = 0; i < dataKeyParam.length; i++) {
			testKey(dataKeyParam[i]);
		}
	});
	
	describe("DELETE\t/:key", () => {
		// --------------------
		// helper functions
		// --------------------

		const testKey = function(key) {
			test("invalid request with key (" + typeof key + ")", async () => {
				const res = await request(app)
					.delete("/" + String(key))
					.set("Cookie", ["aad-token=valid-user"])
					.send();
				
				expect(authenticate).toHaveBeenCalled();
				expect(identify).toHaveBeenCalled();
				expectNotFound(res);
			});
		};

		// --------------------
		// tests
		// --------------------

		test("invalid request (simple) empty", async () => {
			const res = await request(app)
				.delete("/" + urls.simple.key)
				.send();
				
			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectUnauthorized(res);
		});

		test("valid request (simple) with token", async () => {
			const res = await request(app)
				.delete("/" + urls.simple.key)
				.set("Cookie", ["aad-token=valid-user"])
				.send();
				
			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectNoContent(res);
		});

		test("invalid request (simple) with invalid token", async () => {
			const res = await request(app)
				.delete("/" + urls.simple.key)
				.set("Cookie", ["aad-token=xyz"])
				.send();
				
			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectForbidden(res);
		});

		test("valid request (simple) with anon-id", async () => {
			const res = await request(app)
				.delete("/" + urls.simple.key)
				.set("Cookie", ["anon-id=" + uuidv4()])
				.send();
				
			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectUnauthorized(res);
		});

		test("valid request (simpleKey) with token and anon-id", async () => {
			const res = await request(app)
				.delete("/" + urls.simpleKey.key)
				.set("Cookie", ["aad-token=valid-user", "anon-id=" + uuidv4()])
				.send();
				
			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectNoContent(res);
		});

		test("invalid request: not found", async () => {
			const res = await request(app)
				.delete("/unknown")
				.set("Cookie", ["aad-token=other-valid-user", "anon-id=" + uuidv4()])
				.send();
				
			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectNotFound(res);
		});

		for(var i = 0; i < dataKeyParam.length; i++) {
			testKey(dataKeyParam[i]);
		}

		test("valid request (persistent0) with token", async () => {
			const res = await request(app)
				.delete("/" + urls.persistent0.key)
				.set("Cookie", ["aad-token=valid-admin"])
				.send();
				
			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectNoContent(res);
		});

		test("valid request (persistent1) with token", async () => {
			const res = await request(app)
				.delete("/" + urls.persistent1.key)
				.set("Cookie", ["aad-token=valid-admin"])
				.send();
				
			expect(authenticate).toHaveBeenCalled();
			expect(identify).toHaveBeenCalled();
			expectNoContent(res);
		});
	});

	// --------------------------------------------------------------------
	// tear down
	// --------------------------------------------------------------------

	afterAll(async () => {
		await datamanager.drop();
		await datamanager.close();
	});

});

