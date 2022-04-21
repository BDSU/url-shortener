jest.setTimeout(30000);

const _ = require("lodash");
const { v4: uuidv4 } = require("uuid");
var jwt = require("jsonwebtoken");
const { fail } = require("assert");

// change App ID and Tenant ID for tests
const CONFIG = require("../src/config/config.js");
CONFIG.app.oauth.appid = "7d445db3-8373-4584-9f75-01c69f94c833";
CONFIG.app.oauth.tenantid = "3c669c6b-e284-4c7a-9e05-b0505a4f62ae";

const {
	decodeJWT,
	identify,
	authenticate
} = require("../src/api/middleware/auth.js");
const {
	getOAuthClient,
	getApplicationRoles,
	getAssignedUsers
} = require("../src/helper/aad.js");
const { auth } = require("./helper/expectfn.js");
const {
	expectIdentification,
	expectGeneralError,
	expectPayload,
	expectAuthenticated
} = auth;

// secret for testing purpose
const JWT_SECRET = "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";
// random uuids
const APP_ROLE_ID = "0e009b87-cc13-4d43-90bb-bcc9e7729095";
const ADMIN_ID = "883876be-307c-4b53-9069-38b670084e44";

// --------------------------------------------------------------------
// helper
// --------------------------------------------------------------------

/**
 * generates jwt with provided oid. set random appid and tid if matching is false.
 * use appid and tid from CONFIG otherwise
 * @param {String} oid  uuid of user
 * @param {Boolean} matching token matches tenant and app if true
 * @returns jwt
 */
function generateJWT(oid, matching) {
	var payload;
	if(matching) {
		payload = { 
			oid: oid,
			appid: CONFIG.app.oauth.appid,
			tid: CONFIG.app.oauth.tenantid,
		};
	} else {
		payload = { 
			oid: oid,
			appid: uuidv4(),
			tid: uuidv4(),
		};
	}
	return jwt.sign(payload, JWT_SECRET);
}

// --------------------------------------------------------------------
// mock
// --------------------------------------------------------------------

jest.mock("../src/helper/aad.js", () => {
	const original = jest.requireActual("../src/helper/aad.js");
	return {
		...original,
		getOAuthClient: jest.fn(),
		getApplicationRoles: jest.fn(),
		getAssignedUsers: jest.fn()
	};
});

// eslint-disable-next-line no-unused-vars
getOAuthClient.mockImplementation((_clientId, _secret, _tenantId, _redirectUri) => {
	return new Object(); // oauth client
});

// eslint-disable-next-line no-unused-vars
getApplicationRoles.mockImplementation((_objectId, _token) => {
	return Promise.resolve([
		{
			id: APP_ROLE_ID, 
			name: "AdminRole"
		}
	]);
});

// eslint-disable-next-line no-unused-vars
getAssignedUsers.mockImplementation((_objectId, _token) => {
	return Promise.resolve([
		{
			userId: ADMIN_ID,
			appRoleId: APP_ROLE_ID
		}
	]);
});

// --------------------------------------------------------------------
// test suite
// --------------------------------------------------------------------

describe("url-shortener - config", () => {

	// --------------------------------------------------------------------
	// setup
	// --------------------------------------------------------------------

	// express request and response templates
	const reqTempl = {
		cookies: {
			"aad-token": undefined,
			"anon-id": undefined
		},
		decoded: {
			oid: undefined
		}
	};
	const resTempl = {
		cookie: function(key, value, opts) {
			this.cookies[key] = {
				value: value,
				maxAge: opts.maxAge || undefined
			};
		},
		cookies: {}
	};

	// --------------------------------------------------------------------
	// tests
	// --------------------------------------------------------------------

	describe("decodeJWT", () => {
		test("decode valid token", async () => {
			const token = generateJWT(uuidv4(), true);
			const decoded = decodeJWT(token);
			expectPayload(decoded, true);
		});

		test("decode valid admin token", async () => {
			const token = generateJWT(ADMIN_ID, true);
			const decoded = decodeJWT(token);
			expectPayload(decoded, true);
		});

		test("decode invalid token", async () => {
			const token = generateJWT(uuidv4(), false);
			const decoded = decodeJWT(token);
			expectPayload(decoded);
		});

		test("decode malformed token", async () => {
			const decoded = decodeJWT("malformed");
			expect(decoded).toBeNull();
		});

		test("decode empty token", async () => {
			const decoded = decodeJWT("");
			expect(decoded).toBeNull();
		});

		test("decode undefined token", async () => {
			const decoded = decodeJWT(undefined);
			expect(decoded).toBeNull();
		});

		test("decode null token", async () => {
			const decoded = decodeJWT(null);
			expect(decoded).toBeNull();
		});
	});

	describe("identify", () => {
		test("empty", async () => {
			var res = _.cloneDeep(resTempl);
			var req = _.cloneDeep(reqTempl);
			delete req.decoded;
			req.cookies = {};
			
			identify(req, res, (err) => {
				if(err) {
					// eslint-disable-next-line no-console
					console.log(err);
					fail("error should not occur");
				}
				expectIdentification(req, res);
			});
		});

		test("anon-id", async () => {
			var res = _.cloneDeep(resTempl);
			var req = _.cloneDeep(reqTempl);
			delete req.decoded;
			delete req.cookies["aad-token"];
			req.cookies["anon-id"] = uuidv4();
			

			identify(req, res, (err) => {
				if(err) {
					// eslint-disable-next-line no-console
					console.log(err);
					fail("error should not occur");
				}
				expectIdentification(req, res);
				expect(req.decoded.oid === req.cookies["anon-id"]).toBeTruthy();
			});
		});

		test("undecoded aad-token", async () => {
			var res = _.cloneDeep(resTempl);
			var req = _.cloneDeep(reqTempl);
			delete req.decoded;
			delete req.cookies["anon-id"];
			req.cookies["aad-token"] = generateJWT(uuidv4(), true);
			

			identify(req, res, (err) => {
				if(err) {
					// eslint-disable-next-line no-console
					console.log(err);
					fail("error should not occur");
				}
				expectIdentification(req, res);
			});
		});

		test("undecoded aad-token and different anon-id", async () => {
			var res = _.cloneDeep(resTempl);
			var req = _.cloneDeep(reqTempl);
			delete req.decoded;
			req.cookies["anon-id"] = uuidv4();
			req.cookies["aad-token"] = generateJWT(uuidv4(), true);
			

			identify(req, res, (err) => {
				if(err) {
					// eslint-disable-next-line no-console
					console.log(err);
					fail("error should not occur");
				}
				expectIdentification(req, res);
			});
		});

		test("previously decoded aad-token", async () => {
			var res = _.cloneDeep(resTempl);
			var req = _.cloneDeep(reqTempl);
			const token = generateJWT(uuidv4(), true);

			req.decoded = decodeJWT(token);
			delete req.cookies["anon-id"];
			req.cookies["aad-token"] = _.cloneDeep(token);

			identify(req, res, (err) => {
				if(err) {
					// eslint-disable-next-line no-console
					console.log(err);
					fail("error should not occur");
				}
				expectIdentification(req, res);
			});
		});

		test("previously decoded aad-token and anon-id", async () => {
			var res = _.cloneDeep(resTempl);
			var req = _.cloneDeep(reqTempl);
			const token = generateJWT(uuidv4(), true);

			req.decoded = decodeJWT(token);
			req.cookies["anon-id"] = uuidv4();
			req.cookies["aad-token"] = _.cloneDeep(token);

			identify(req, res, (err) => {
				if(err) {
					// eslint-disable-next-line no-console
					console.log(err);
					fail("error should not occur");
				}
				expectIdentification(req, res);
			});
		});
	});

	describe("authenticate", () => {
		test("empty", async () => {
			var res = _.cloneDeep(resTempl);
			var req = _.cloneDeep(reqTempl);
			delete req.decoded;
			req.cookies = {};

			authenticate(req, res, (err) => {
				if(!err) {
					// eslint-disable-next-line no-console
					console.log(err);
					fail("error should occur");
				}
				expectGeneralError(err, 401);
			});
		});

		test("invalid token", async () => {
			var res = _.cloneDeep(resTempl);
			var req = _.cloneDeep(reqTempl);
			delete req.decoded;
			req.cookies["aad-token"] = "invalid";

			authenticate(req, res, (err) => {
				if(!err) {
					// eslint-disable-next-line no-console
					console.log(err);
					fail("error should occur");
				}
				expectGeneralError(err, 403);
			});
		});

		test("token with unexpectet payload", async () => {
			var res = _.cloneDeep(resTempl);
			var req = _.cloneDeep(reqTempl);
			delete req.decoded;
			req.cookies["aad-token"] = generateJWT(uuidv4(), false);

			authenticate(req, res, (err) => {
				if(!err) {
					// eslint-disable-next-line no-console
					console.log(err);
					fail("error should occur");
				}
				expectGeneralError(err, 403);
			});
		});

		test("token with valid payload", async () => {
			var res = _.cloneDeep(resTempl);
			var req = _.cloneDeep(reqTempl);
			delete req.decoded;
			req.cookies["aad-token"] = generateJWT(uuidv4(), true);

			authenticate(req, res, (err) => {
				expect(_.isUndefined(err)).toBeTruthy();
				if(err) {
					// eslint-disable-next-line no-console
					console.error(err);
				} else {
					expectAuthenticated(req);
				}
			});
		});

		test("admin token with valid payload", async () => {
			var res = _.cloneDeep(resTempl);
			var req = _.cloneDeep(reqTempl);
			delete req.decoded;
			req.cookies["aad-token"] = generateJWT(ADMIN_ID, true);

			authenticate(req, res, (err) => {
				expect(_.isUndefined(err)).toBeTruthy();
				if(err) {
					// eslint-disable-next-line no-console
					console.error(err);
				} else {
					expectAuthenticated(req);
				}
			});
		});
	});

});