const isValidUUID = require("uuid-validate");
const _ = require("lodash");
const CONFIG = require("../../src/config/config.js");

const expectError = function(error) {
	expect(error.code).toBeDefined();
	expect(typeof error.code === "number").toBeTruthy();
	expect(error.code >= 100).toBeTruthy();
	expect(error.code < 600).toBeTruthy();

	expect(error.message).toBeDefined();
	expect(typeof error.message === "string").toBeTruthy();
	expect(error.message.length > 0).toBeTruthy();

	if(error.description) {
		expect(error.description).toBeDefined();
		expect(typeof error.description === "string").toBeTruthy();
		expect(error.description.length > 0).toBeTruthy();
	}
};

const expectEntry = function(entry) {
	expect(entry.key).toBeDefined();
	expect(typeof entry.key === "string").toBeTruthy();
	expect(entry.key.length >= 2).toBeTruthy();
	expect(entry.key.length <= 16).toBeTruthy();

	expect(entry.oid).toBeDefined();
	expect(typeof entry.oid === "string").toBeTruthy();
	expect(isValidUUID(entry.oid)).toBeTruthy();

	expect(entry.longurl).toBeDefined();
	expect(typeof entry.longurl === "string").toBeTruthy();

	expect(entry.shorturl).toBeDefined();
	expect(typeof entry.shorturl === "string").toBeTruthy();

	expect(entry.persistent).toBeDefined();
	expect(typeof entry.persistent === "boolean").toBeTruthy();

	expect(entry.createdAt).toBeDefined();
	expect(typeof entry.createdAt === "string").toBeTruthy();
	expect(entry.createdAt.length === 24).toBeTruthy();

	expect(entry.updatedAt).toBeDefined();
	expect(typeof entry.updatedAt === "string").toBeTruthy();
	expect(entry.updatedAt.length === 24).toBeTruthy();
};

module.exports = {
	auth: {
		expectIdentification: function(req, res) {
			expect(isValidUUID(req.decoded.oid)).toBeTruthy();
			expect(req.decoded.oid === res.cookies["anon-id"].value).toBeTruthy();
			expect(res.cookies["anon-id"].maxAge).toEqual(1000 * 60 * 60 * 24 * 365 * 10);
		},
		expectGeneralError: function(err, errorCode) {
			expect(err.code).toBeDefined();
			expect(err.code).toEqual(errorCode);
			expectError(err);
		},
		expectPayload: function(decoded, matching = false) {
			expect(decoded).toBeDefined();
			expect(typeof decoded === "object");
			
			expect(decoded.oid).toBeDefined();
			expect(isValidUUID(decoded.oid)).toBeTruthy();
		
			expect(decoded.appid).toBeDefined();
			expect(isValidUUID(decoded.appid)).toBeTruthy();
		
			expect(decoded.tid).toBeDefined();
			expect(isValidUUID(decoded.tid)).toBeTruthy();
		
			if(matching) {
				expect(decoded.appid).toEqual(CONFIG.app.oauth.appid);
				expect(decoded.tid).toEqual(CONFIG.app.oauth.tenantid);
			}
		},
		expectAuthenticated: function(req) {
			expect(req).toBeDefined();
			expect(req.decoded).toBeDefined();
		
		
			expect(req.decoded.oid).toBeDefined();
			expect(isValidUUID(req.decoded.oid)).toBeTruthy();
		
			expect(req.decoded.admin).toBeDefined();
			expect(_.isBoolean(req.decoded.admin)).toBeTruthy();
		
			expect(req.decoded.token).toBeDefined();
			expect(_.isString(req.decoded.token)).toBeTruthy();
		
			expect(req.decoded.decoded).toBeDefined();
			expect(_.isObject(req.decoded.decoded)).toBeTruthy();
			
		
			expect(req.decoded.decoded.oid).toBeDefined();
			expect(isValidUUID(req.decoded.decoded.oid)).toBeTruthy();
		
			expect(req.decoded.decoded.appid).toBeDefined();
			expect(isValidUUID(req.decoded.decoded.appid)).toBeTruthy();
		
			expect(req.decoded.decoded.tid).toBeDefined();
			expect(isValidUUID(req.decoded.decoded.tid)).toBeTruthy();
		}
	},
	api: {
		expectCreated: function(res) {
			expect(res.statusCode).toBeDefined();
			expect(res.statusCode).toEqual(201);
			expectEntry(res.body);
		},
		expectUpdated: function(res) {
			expect(res.statusCode).toBeDefined();
			expect(res.statusCode).toEqual(200);
			expectEntry(res.body);
		},
		expectInfo: function(res) {
			expect(res.statusCode).toBeDefined();
			expect(res.statusCode).toEqual(200);
			expectEntry(res.body);
		},
		expectStats: function(res) {
			expect(res.statusCode).toBeDefined();
			expect(res.statusCode).toEqual(200);
		
			const stats = res.body;
		
			expect(stats.key).toBeDefined();
			expect(typeof stats.key === "string").toBeTruthy();
			expect(stats.key.length >= 4).toBeTruthy();
			expect(stats.key.length <= 16).toBeTruthy();
		
			expect(stats.calls).toBeDefined();
			expect(typeof stats.calls === "number").toBeTruthy();
			expect(stats.calls >= 0).toBeTruthy();
		
			expect(stats.uniqueCallers).toBeDefined();
			expect(typeof stats.uniqueCallers === "number").toBeTruthy();
			expect(stats.uniqueCallers >= 0).toBeTruthy();
		
			expect(stats.callsOfUniqueCallers).toBeDefined();
			expect(Array.isArray(stats.callsOfUniqueCallers)).toBeTruthy();
			for(var i = 0; i < stats.callsOfUniqueCallers.length; i++) {
				expect(typeof stats.callsOfUniqueCallers[i] === "number").toBeTruthy();
				expect(stats.callsOfUniqueCallers[i] >= 0).toBeTruthy();
			}
		
			expect(stats.history).toBeDefined();
			expect(Array.isArray(stats.history)).toBeTruthy();
			for(i = 0; i < stats.history.length; i++) {
				expect(stats.history[i]).toBeDefined();
				expect(typeof stats.history[i] === "object").toBeTruthy();
		
				expect(stats.history[i].date).toBeDefined();
				expect(typeof stats.history[i].date === "string").toBeTruthy();
				expect(stats.history[i].date.length === 10).toBeTruthy();
		
				expect(stats.history[i].calls).toBeDefined();
				expect(typeof stats.history[i].calls === "number").toBeTruthy();
				expect(stats.history[i].calls >= 0).toBeTruthy();
			}
		},
		expectAllKeys: function(res) {
			expect(res.statusCode).toBeDefined();
			expect(res.statusCode).toEqual(200);
		
			expect(res.body).toBeDefined();
			expect(Array.isArray(res.body)).toBeTruthy();
			expect(res.body.length >= 0).toBeTruthy();
		
			for(var i = 0; i < res.body.length; i++) {
				expect(res.body[i]).toBeDefined();
				expect(typeof res.body[i] === "string").toBeTruthy();
			}
		},
	},
	expectError: expectError,
	expectEntry: expectEntry,
	expectEntryFromDatamanager: function(entry) {
		expect(entry.key).toBeDefined();
		expect(typeof entry.key === "string").toBeTruthy();
		expect(entry.key.length >= 4).toBeTruthy();
		expect(entry.key.length <= 16).toBeTruthy();
	
		expect(entry.oid).toBeDefined();
		expect(typeof entry.oid === "string").toBeTruthy();
		expect(isValidUUID(entry.oid)).toBeTruthy();
	
		expect(entry.longurl).toBeDefined();
		expect(typeof entry.longurl === "string").toBeTruthy();
	
		expect(entry.persistent).toBeDefined();
		expect(typeof entry.persistent === "boolean").toBeTruthy();
	
		const createdAt = new Date(entry.createdAt).toISOString();
		expect(createdAt).toBeDefined();
		expect(typeof createdAt === "string").toBeTruthy();
		expect(createdAt.length === 24).toBeTruthy();
	
		const updatedAt = new Date(entry.updatedAt).toISOString();
		expect(updatedAt).toBeDefined();
		expect(typeof updatedAt === "string").toBeTruthy();
		expect(updatedAt.length === 24).toBeTruthy();
	},
	expectNoContent: function(res) {
		expect(res.statusCode).toBeDefined();
		expect(res.statusCode).toEqual(204);
	},	
	expectRedirect: function(res) {
		expect(res.statusCode).toBeDefined();
		expect(res.statusCode).toEqual(302);
	
		expect(res.headers["location"]).toBeDefined();
	},	
	expectUnauthorized: function(res) {
		expect(res.statusCode).toBeDefined();
		expect(res.statusCode).toEqual(401);
		expectError(res.body);
	},	
	expectForbidden: function(res) {
		expect(res.statusCode).toBeDefined();
		expect(res.statusCode).toEqual(403);
		expectError(res.body);
	},	
	expectBadRequest: function(res) {
		expect(res.statusCode).toBeDefined();
		expect(res.statusCode).toEqual(400);
		expectError(res.body);
	},
	expectBadRequestValidation: function(res) {
		expect(res.statusCode).toBeDefined();
		expect(res.statusCode).toEqual(400);
	
		expect(res.body.errors).toBeDefined();
		expect(Array.isArray(res.body.errors)).toBeTruthy();
		expect(res.body.errors.length > 0).toBeTruthy();
	
		for(var i = 0; i < res.body.errors.length; i++) {
			const e = res.body.errors[i];
			
			expect(e.msg).toBeDefined();
			expect(typeof e.msg === "string").toBeTruthy();
	
			expect(e.param).toBeDefined();
			expect(typeof e.param === "string").toBeTruthy();
	
			expect(e.location).toBeDefined();
			expect(typeof e.location === "string").toBeTruthy();
		}
	
	},	
	expectNotFound: function(res) {
		expect(res.statusCode).toBeDefined();
		expect(res.statusCode).toEqual(404);
		expectError(res.body);
	},
	expectInternalServerError: function(res) {
		expect(res.statusCode).toBeDefined();
		expect(res.statusCode).toEqual(500);
		expectError(res.body);
	}
};



