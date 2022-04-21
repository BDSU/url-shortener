const debug = require("debug")("url-shortener:controller");
const process = require("process");
const delay = require("delay");
const async = require("async");

const Router = require("./router.js");
const Server = require("./server.js");
const CONFIG = require("../config/config.js");

const DataManager = require("../persistence/instance.js");

// --------------------------------------------------------------------
// helper
// --------------------------------------------------------------------

// clean entries older than entryMaxAge
const cleanExpiredEntries = function(datamanager) {
	debug("cleaning expired entries ...");

	var keys = [];
	datamanager.findExpiredEntries(CONFIG.app.entryMaxAge).then(result => {
		debug("found expired entries: " + result.length);
		keys = result.map(e => e.key);
		return datamanager.deleteCallsOfExpiredEntries(keys);
	}).then(result => {
		debug("calls of expired entries deleted: " + result.deletedCount);
		return datamanager.deleteExpiredEntries(keys);
	}).then(result => {
		debug("expired entries deleted: " + result.deletedCount);
	}).catch(error => {
		debug("failed to clean expired entries and corresponding calls");
		// eslint-disable-next-line no-console
		console.error(error);
	});
};

// --------------------------------------------------------------------
// class
// --------------------------------------------------------------------

module.exports = class Controller {

	constructor() {
		debug("initializing controller ...");
		debug(JSON.stringify(CONFIG));

		this.exiting = false;
		
		this.datamanager = new DataManager(CONFIG.mongo).getInstance();
		this.router = new Router(this.datamanager);
		this.server = new Server(this.router.getAppRouter(), {
			ssl: CONFIG.server.ssl.active,
			key: CONFIG.server.ssl.key,
			cert: CONFIG.server.ssl.cert,
			port: CONFIG.server.port
		});
		this.cleaningInterval = undefined;

		try {
			this._initializeListeners();
		} catch(error) {
			debug("failed to initialize listeners");
			this._handleError(error);
		}
		
		if(this.server.listen()) {
			this.datamanager.connect().catch((error) => {
				debug("failed to establish database connection");
				return Promise.reject(error);
			}).then(() => {
				debug("checking database access ...");
				return this.datamanager.check();
			}).then(() => {
				// clean expired entries
				debug("set clean interval to " + CONFIG.app.cleanInterval + " minute(s)");
				debug("set entry max age to " + CONFIG.app.entryMaxAge + " minute(s)");
				this.cleaningInterval = setInterval(function() {
					cleanExpiredEntries(this.datamanager);
				}.bind(this), 1000 * 60 * CONFIG.app.cleanInterval);
			
				debug("controller initialized");
			}).catch((error) => {
				debug("failed database access check");
				this._handleError(error);
			});
		} else {
			debug("server failed to listen");
			debug("initialization stopped");
		}
		
	}

	/**
	 * graceful exit routine: close server and database connection to avoid unknown app state
	 */
	_gracefulExit() {
		if(!this.exiting) {
			debug("exiting gracefully ...");
			this.exiting = true;
			async.waterfall([
				(callback) => {
					clearInterval(this.cleaningInterval);
					debug("interval cleanExpiredEntries cleared");
					callback();
				},
				(callback) => {
					debug("closing database connection ...");
					try {
						if(this.datamanager.connected) {
							this.datamanager.close();
							debug("database connection closed");
						} else {
							debug("no database connection to close");
						}
					} catch(error) {
						debug("failed to close database connection");
						// eslint-disable-next-line no-console
						console.error(error);
					}
					callback();
				},
				(callback) => {
					debug("closing server ...");
					this.server.close((err, res) => {
						if(!err || res) {
							debug("server closed");
						}
						callback();
					});
				}, () => {
					debug("exit process");
					delay(500);
					process.exit(0);
				}
			]);
		} else {
			debug("controller is already exiting gracefully ...");
		}
	}

	/**
	 * initialize listeners for gracefulexit, exceptions and termination
	 */
	_initializeListeners() {
		this.server.on("gracefulexit", (errors) => {
			debug("graceful exit initiated by server");
			this._handleError(errors[0]);
		});

		this.router.on("gracefulexit", (errors) => {
			debug("graceful exit initiated by router");
			this._handleError(errors[0]);
		});

		process.on("uncaughtException", (error) => {
			debug("uncaught exception");
			this._handleError(error);
		});

		process.on("SIGINT", () => { 
			debug("signal received: SIGINT");
			this._handleError("user interruption");
		});

		process.on("SIGTERM", () => { 
			debug("signal received: SIGTERM");
			this._handleError("interruption");
		});

		debug("listeners initialized");
	}

	/**
	 * log error and initiate graceful exit
	 * @param {String} error 
	 */
	_handleError(error) {
		if(!this.gracefulexit) {
			// eslint-disable-next-line no-console
			console.error((error && error.stack) ? error.stack : error);
			this.gracefulexit = true;
			this._gracefulExit();			
		}
	}
	
};