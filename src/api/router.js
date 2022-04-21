const debug = require("debug")("url-shortener:router");
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const cookieParser = require("cookie-parser");
const { Crawler } = require("es6-crawler-detect");
const morgan = require("morgan");
const helmet = require("helmet");
const _ = require("lodash");
const EventEmitter = require("events").EventEmitter;
const delay = require("delay");

const {
	validateUrlBody,
	validateUpdatedUrlBody,
	validateKeyParam,
	getValidationErrors
} = require("./middleware/validation.js");
const {
	authenticate,
	authorize,
	getOAuthClientInstance,
	identify
} = require("./middleware/auth.js");
const CONFIG = require("../config/config.js");



// --------------------------------------------------------------------
// helper functions
// --------------------------------------------------------------------

/**
 * handler for validation errors
 * @param {Express.Request} _req 
 * @param {Express.Response} res 
 * @param {Express.NextFunction} next 
 */ 
function handleValidationErrors() {
	return [
		getValidationErrors,
		(_req, res, next) => {
			const errors = res.locals.errors;
			if (!errors.isEmpty()) {
				debug("validation errors: " + JSON.stringify(errors));
				res.status(400).send(errors);
			} else {
				next();
			}
		}
	];

}

/**
 * handler for validation errors for key
 * @param {Express.Request} _req 
 * @param {Express.Response} res 
 * @param {Express.NextFunction} next 
 */ 
function handleKeyValidationErrors() {
	return [
		getValidationErrors,
		(_req, res, next) => {
			const errors = res.locals.errors;
			if (!errors.isEmpty()) {
				debug("key validation errors: " + JSON.stringify(errors));
				next({
					code: 404,
					message: "not found",
					description: "the provided key is invalid"
				});
			} else {
				next();
			}
		}
	];
}

/**
 * prepare shorturl based on server settings and key
 * @param key 
 * @returns String
 */
function getShortUrl(key) {
	return (CONFIG.server.ssl.active ? "https" : "http") + "://" + CONFIG.server.host + ":" + CONFIG.server.port + "/" + key;
}

// --------------------------------------------------------------------
// class
// --------------------------------------------------------------------

module.exports = class Router extends EventEmitter {

	constructor(datamanager) {
		super();
		debug("initializing router ...");

		this.router = express();
		this.datamanager = datamanager;

		this._registerMiddleware();
		this._registerOAuth2Endpoints();
		this._registerAppEndpoints();
		this._registerErrorHandlers();

		debug("router initialized");
	}

	/**
	 * register general middleware
	 */
	_registerMiddleware() {
		this.router.use(express.json({
			inflate: false,
			strict: true,
			type: "application/json"
		}));

		this.router.use(cookieParser());

		this.router.use(helmet());
		
		// set unique request id
		this.router.use(
			(req, _res, next) => {
				const tmpId = req.get("X-Request-Id");
				const id = (tmpId === undefined) ? uuidv4() : tmpId;
				req["X-Request-Id"] = id;
				next();
			}
		);
		
		morgan.token("reqId", (req) => {
			return req.id;
		});	
		morgan.token("anonId", (req) => {
			return req.cookies["anon-id"] || "";
		});
		morgan.format("combined", ":remote-addr - [reqId=:reqId] [anonId=:anonId] - \":method :url HTTP/:http-version\" :status :res[content-length] :response-time ms");
		
		this.router.use(morgan("combined"));
		debug("general middleware initialized");
	}

	/**
	 * register oauth2 endpoints for user authentification
	 */
	_registerOAuth2Endpoints() {

		const oauthClient = getOAuthClientInstance();

		this.router.get("/oauth", (_req, res) => {
			const uri = oauthClient.code.getUri();
			debug("redirect to auth provider");
			res.redirect(uri);
		});

		this.router.get("/oauth/callback", async (req, res, next) => {
			debug("oauth callback received");

			try {
				const user = await oauthClient.code.getToken(req.originalUrl);

				res.cookie("aad-token", user.accessToken, {
					maxAge: 1000 * user.data.expires_in
				});
				debug("set cookie 'aad-token'");
	
				debug("redirect to '/'");
				res.redirect("/");
			} catch(error) {
				debug("unable to process oauth callback: " + JSON.stringify(error));
				return next({
					code: 400,
					message: "bad request",
					description: "unable to process oauth callback"
				});
			}
		});

		debug("oauth2 endpoints initialized");
	}

	/**
	 * register all endpoints
	 */
	_registerAppEndpoints() {

		/**
		 * find entry with given key and handle promise as reusable middleware function (requires 'this')
		 * @param {Express.Request} req 
		 * @param {Express.Response} res 
		 * @param {Express.NextFunction} next 
		 */
		function findEntryWithKey(req, res, next) {
			// check if key exists
			const key = req.params.key;
			debug("finding entry with key '" + key + "' ...");
			this.datamanager.findEntry(key).then(entry => {
				if(entry == null) {
					debug("no entry with key '" + key + "' found");
					next({
						code: 404,
						message: "not found",
						description: "the requested resource was not found: " + key
					});
				} else {
					debug("found entry with key '" + key + "'");
					res.locals.entry = entry;
					next();
				}
			}).catch(error => {
				debug("failed to find entry with key '" + key + "'");
				next(error);
			});			
		}

		// get all keys
		this.router.get("/", 
			authenticate,
			identify,
			(_req, res, next) => {
				this.datamanager.findAllEntries()
					.then(entries => {
						debug("found keys: " + entries.length);
						res.locals.entries = entries.map(entry => entry.key);
						next();
					}).catch((error) => {
						debug("unable to find keys");
						next(error);
					});
			},
			(_req, res) => {
				res.status(200).send(res.locals.entries);
				debug("response sent with http 200 (" + JSON.stringify(res.locals.entries).length + " chars)");		
			}
		);
		
		// create new entry with key
		this.router.post("/",
			authenticate,
			validateUrlBody(),
			handleValidationErrors(),
			identify,
			(req, res, next) => {
				res.locals.entry = {
					key: undefined,
					oid: req.decoded.oid,
					longurl: req.body.longurl,
					shorturl: undefined,
					persistent: req.body.persistent || false,
				};

				
				if(!req.body.key) {
					this.datamanager.createKey().catch((error) => {
						debug("debug could not create entry");
						next(error);
					}).then((newKey) => {
						debug("created new key: " + newKey);
						res.locals.newKey = newKey;
						next();
					});
				} else {
					// check entries for duplicates with provided key
					res.locals.newKey = req.body.key;

					this.datamanager.findEntry(res.locals.newKey).then(entry => {
						if(entry == null) {
							debug("no entry with key '" + res.locals.newKey + "' found");
							next();
						} else {
							debug("found entry with key '" + res.locals.newKey + "'");
							next({
								code: 400,
								message: "bad request",
								description: "an entry with with this key does already exist: " + res.locals.newKey
							});
						}
					}).catch(error => {
						debug("failed to find entry with key '" + res.locals.newKey + "'");
						next(error);
					});
				}
			},(_req, res, next) => {
				res.locals.entry.key = res.locals.newKey;
				delete res.locals.newKey;

				res.locals.entry.shorturl = getShortUrl(res.locals.entry.key);

				this.datamanager.addEntry(res.locals.entry).then(result => {
					debug("entry added with key '" + result.key + "'");
					res.locals.entry.createdAt = result.createdAt;
					res.locals.entry.updatedAt = result.updatedAt;
					next();
				}).catch((error) => {
					debug("debug could not create entry");
					next(error);
				});
			},
			(_req, res) => {
				res.status(201).send(res.locals.entry);
				debug("response sent with http 204 (" + JSON.stringify(res.locals.entry).length + " chars)");		
			}
		);
		
		// get redirected to longurl with key
		this.router.get("/:key",
			validateKeyParam(),
			handleKeyValidationErrors(),
			identify,
			findEntryWithKey.bind(this),
			(req, res, next) => {
				debug("main routine start: " + (res.locals.entry !== undefined));
				// skip updating of statistics if crawler is detected
				const CrawlerDetector = new Crawler(req);
				if(req.headers["user-agent"] && CrawlerDetector.isCrawler(req.headers["user-agent"])) {
					debug("crawler detected: skip");
					next();
				} else {
					// update detailed statistics for key if tracking is enabled
					var info = {
						key: req.params.key
					};
				
					if(CONFIG.app.tracking) {
						info.userId = req.decoded.oid;
					}

					this.datamanager.addCall(info).then(() => {
						debug("added call to key '" + req.params.key + "'");
						next();
					}).catch(error => {
						debug("failed to add call with key '" + req.params.key + "'");
						next(error);
					});
				}
			}, (_req, res) => {
				debug("send response");
				res.set({
					"location": res.locals.entry.longurl
				}).status(302).send();
				debug("redirected to '" + res.locals.entry.longurl + "'");
			}
		);
		
		// update longurl of key
		this.router.put("/:key",
			authenticate,
			identify,
			validateKeyParam(),
			handleKeyValidationErrors(),
			findEntryWithKey.bind(this),
			authorize,
			validateUpdatedUrlBody(),
			handleValidationErrors(),
			(req, res, next) => {
				if(_.isUndefined(req.body.persistent) && _.isUndefined(req.body.longurl)) {
					debug("missing property");
					next({
						code: 400,
						message: "bad request",
						description: "body must contain at least one property: longurl, persistent"
					});
				} else {
					// update long url of key in database
					res.locals.entry.updatedAt = new Date();
					if(res.locals.longurl) {
						res.locals.entry.longurl = req.body.longurl;
					}
					if(req.body.persistent) {
						res.locals.entry.persistent = req.body.persistent;
					}

					const props = Object(_.pick(res.locals.entry, ["longurl", "persistent", "updatedAt"]));
					this.datamanager.updateEntry(res.locals.entry.key, props).then(result => {
						debug("updated entry with key '" + result.key + "'");
						res.locals.entry.shorturl = getShortUrl(result.key);
						next();
					}).catch((error) => {
						debug("debug could not create entry");
						next(error);
					});
				}
			}, (_req, res) => {
				const data = Object(
					_.pick(res.locals.entry, [
						"key",
						"oid",
						"longurl",
						"shorturl",
						"persistent",
						"createdAt",
						"updatedAt"
					])
				);
				res.status(200).send(data);
			}
		);

		// delete entry with key
		this.router.delete("/:key",
			authenticate,
			identify,
			validateKeyParam(),
			handleKeyValidationErrors(),
			findEntryWithKey.bind(this),
			authorize,
			(req, _res, next) => {
				// delete database entrey for key
				this.datamanager.deleteEntry(req.params.key).then(result => {
					debug("deleted " + result.deletedCount + " element(s)");
					return this.datamanager.deleteCalls(req.params.key);
				}).then(result => {
					debug("deleted " + result.deletedCount + " calls(s)");
					next();
				}).catch(error => {
					next(error);
				});
			}, (req, res) => {
				res.status(204).send();
				debug("key '" + req.params.key + "' deleted");
			}
		);

		// get info about entry with key
		this.router.get("/:key/info",
			authenticate,
			identify,
			validateKeyParam(),
			handleKeyValidationErrors(),
			findEntryWithKey.bind(this),
			authorize,
			(req, res) => {
				const data = _.merge(
					Object(
						_.pick(res.locals.entry, [
							"key",
							"oid",
							"longurl",
						])
					), {
						shorturl: getShortUrl(res.locals.entry.key)
					}, Object(
						_.pick(res.locals.entry, [
							"persistent",
							"createdAt",
							"updatedAt"
						])
					)
				);

				res.status(200).send(data);
				debug("got info of key '" + req.params.key + "'");
			}
		);

		// get statistics about entry with key
		this.router.get("/:key/stats",
			authenticate,
			identify,
			validateKeyParam(),
			handleKeyValidationErrors(),
			findEntryWithKey.bind(this),
			authorize,
			(req,res, next) => {
				this.datamanager.findUniqueCallersStatistic(req.params.key).catch(error => {
					debug("failed to find unique callers with key '" + req.params.key + "'");
					next(error);
				}).then(result => {
					debug("found " + result.length + " unique caller(s) with key '" + req.params.key + "'");
					res.locals.uniqueCallers = result;
					return this.datamanager.findCallsPerDateStatistic(req.params.key).catch(error => {
						debug("failed to find dates with key '" + req.params.key + "'");
						next(error);
					});
				}).then(result => {
					debug("found " + result.length + " date(s) with key '" + req.params.key + "'");
					res.locals.history = result;
					next();
				});
			}, (req, res) => {
				var data = {
					key: res.locals.entry.key,
					calls: 0,
					uniqueCallers: res.locals.uniqueCallers.length,
					callsOfUniqueCallers: res.locals.uniqueCallers.map(e => e.calls).sort((a, b) => a < b ? 1 : -1), // number of calls of each unique user
					history: []
				};

				for(var i = 0; i < res.locals.history.length; i++) {
					data.calls += res.locals.history[i].count;
					res.locals.history[i] = {
						date: res.locals.history[i]._id,
						calls: res.locals.history[i].count
					};
				}
				data.history = res.locals.history;

				res.status(200).send(data);
				debug("got statistics of key '" + req.params.key + "'");
			}
		);

		debug("app endpoints initialized");
	}

	/**
	 * handler for 404, 500, and other
	 */
	_registerErrorHandlers() {

		this.router.use((_req, res) => {
			res.status(404).send({
				code: 404,
				message: "not found",
				description: "the requested endpoint was not found"
			});
			debug("NOT FOUND (endpoint)");
		});

		// eslint-disable-next-line no-unused-vars
		this.router.use((err, _req, res, _next) => {
			// handle 404 if a key was not found
			if(err && err.code == 404) {
				res.status(err.code).send(err);
			} else if(err && err.code && typeof err.code == "number") {
				res.status(err.code).send(err);
			} else {
				debug("UNSPECIFIED ERROR: " + JSON.stringify(err));
				res.status(500).send({
					code: 500,
					message: "internal server error"
				});
				
				delay(1000);
				this.emit("gracefulexit", [new Error("unspecified")]);
				debug("emitted gracefulexit");
			}
		});

		debug("error handlers initialized");
	}

	/**
	 * getter
	 * @returns express router
	 */
	getAppRouter() {
		return this.router;
	}

};