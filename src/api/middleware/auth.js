const debug = require("debug")("url-shortener:middleware:auth");
const { v4: uuidv4 } = require("uuid");
const isValidUUID = require("uuid-validate");
const {
	getOAuthClient,
	getApplicationRoles,
	getAssignedUsers
} = require("../../helper/aad.js");
const CONFIG = require("../../config/config.js");

var oauthClient = null;

/**
 * get or create OAuthClient instance
 * @returns OAuthClient
 */
const getOAuthClientInstance = function() {
	if (oauthClient === null) {
		oauthClient = getOAuthClient(CONFIG.app.oauth.appid, CONFIG.app.oauth.secret, CONFIG.app.oauth.tenantid, CONFIG.app.oauth.redirecturi);
	}
	return oauthClient;
};

/**
 * authenticate user by cookie
 * @param req Express request
 * @param _res Express response
 * @param next Express next
 */
const authenticate = function(req, _res, next) {
	debug("authenticate user ...");

	const token = req.cookies["aad-token"];
	getOAuthClientInstance();

	if (token) {
		const decoded = decodeJWT(token);

		if (decoded != null) {
			if (decoded.appid == CONFIG.app.oauth.appid && decoded.tid == CONFIG.app.oauth.tenantid) {
				req.decoded = {
					"oid": decoded.oid,
					"admin": false,
					"token": token,
					"decoded": decoded
				};

				// NOTE: check if user is admin by getting app roles and comparing admin app role id
				debug("getting app roles ...");
				var appAdminRoleId = null;

				return getApplicationRoles(CONFIG.app.oauth.appobjectid, token).then(appRoles => {
					debug("got app roles: " + appRoles.length);

					for (var i = 0; i < appRoles.length; i++) {
						if (appRoles[i].name === "AdminRole") {
							appAdminRoleId = appRoles[i].id;
							break;
						}
					}

					debug("app admin role id: " + appAdminRoleId);

					if (appAdminRoleId === null) {
						return next({
							code: 500,
							message: "internal server error",
							description: "app admin role id is null"
						});
					} else {
						debug("getting assigned users ...");
						return getAssignedUsers(CONFIG.app.oauth.appobjectid, token);
					}
				}).then(users => {
					// NOTE: compare admin app role id with app role ids of users to find possible admin
					debug("got assigned users: " + users.length);
					for (var i = 0; i < users.length; i++) {
						if (users[i].appRoleId == appAdminRoleId && users[i].userId == req.decoded.oid) {
							req.decoded.admin = true;
							break;
						}
					}
					debug("checked for admin");
					return next();
				}).catch((err) => {
					debug("could not get app roles and/or assigned users: " + JSON.stringify(err));
					return next({
						code: 403,
						message: "forbidden"
					});
				});
			} else {
				debug("invalid token content: ids not matching");
				return next({
					code: 403,
					message: "forbidden"
				});
			}

		} else {
			debug("invalid token content: null");
			return next({
				code: 403,
				message: "forbidden"
			});
		}

	} else {
		debug("missing token");
		return next({
			code: 401,
			message: "unauthorized"
		});
	}
};

/**
 * decode payload of JWT token
 * @param token String
 * @returns decoded token or null
 */
const decodeJWT = function(token) {
	if ((token !== null && token !== undefined) && token.includes(".")) {
		const base64String = token.split(".")[1];
		// eslint-disable-next-line no-undef
		const decodedValue = JSON.parse(Buffer.from(base64String, "base64").toString("ascii"));
		return decodedValue;
	}
	return null;
};

/**
 * check if authenticated user is allowed to access a resource
 * @param req Express request
 * @param res Express response
 * @param next Express next
 */
const authorize = function(req, res, next) {
	debug("authorizing ...");

	if(!req.decoded.admin) {
		if(res.locals.entry.oid != req.decoded.oid) {
			debug("access to resource forbidden: /" + res.locals.entry.key);
			return next({
				code: 403,
				message: "forbidden"
			});
		} else {
			debug("authorized as user");
		}
	} else {
		debug("authorized as admin");
	}
	
	next();
};

/**
 * identify caller by token or anonymous id from cookies. create new anonymous id otherwise
 * @param req Express request
 * @param res Express response
 * @param next Express next
 */
const identify = function(req, res, next) {
	debug("identify user ...");
	const token = req.cookies["aad-token"];
	const anonId = req.cookies["anon-id"];

	if(!req.decoded || !req.decoded.oid) {
		var tmpId = null;
		if (token) {
			debug("decoding token ...");
			const decoded = decodeJWT(token);
	
			if(decoded != null) {
				debug("token decoded");
				tmpId = decoded.oid;
			} else {
				debug("unable to decode token. creating new id ...");
				tmpId = uuidv4();	
			}
		} else if (anonId && isValidUUID(anonId)) {
			debug("existing anonymous id found");
			tmpId = anonId;
		} else {
			debug("no token and no anonymous id. creating new id ...");
			tmpId = uuidv4();
		}
	
		req.decoded = {
			oid: tmpId
		};
	}

	// NOTE: expires in 10 years (never)
	debug("set cookie 'anon-id'");
	res.cookie("anon-id", req.decoded.oid, {
		maxAge: 1000 * 60 * 60 * 24 * 365 * 10
	});

	debug("user identified as " + req.decoded.oid);
	next();
};

module.exports = {
	getOAuthClientInstance: getOAuthClientInstance,
	authenticate: authenticate,
	authorize: authorize,
	identify: identify,
	decodeJWT: decodeJWT
};