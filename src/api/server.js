const debug = require("debug")("url-shortener:server");
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const _ = require("lodash");
const EventEmitter = require("events").EventEmitter;

// --------------------------------------------------------------------
// class
// --------------------------------------------------------------------

module.exports = class Server extends EventEmitter {

	constructor(app, options) {
		super();
		debug("initializing server ...");

		this.options = options;
		this.created = false;

		try {
			debug("ssl=" + options.ssl);
			if(options.ssl) {
				debug("reading key and cert ...");

				const pathKey = path.normalize(options.key);
				const pathCrt = path.normalize(options.cert);

				const key = fs.readFileSync(pathKey);
				const crt = fs.readFileSync(pathCrt);

				debug("done reading key and cert");

				this.server = https.createServer({
					key: key,
					cert: crt
				}, app);
			} else {
				this.server = http.createServer(app);
			}
			this.created = true;		
			debug("server created");

			this.server.on("listening", () => {
				debug("server listening on " + options.port);
			});

			this.server.on("error", function(error) {
				this.emit("gracefulexit", [error]);
			});

			debug("server initialized");
		} catch(error) {
			// NOTE: Cannot emit successfully as long as controller has not initialized listeners. Wait for initialization of listeners. However,
			// by not emitting the error and waiting for call of function "listen", an error will be emitted there because the server was not created.
			debug("unable to create server with options: " + JSON.stringify(options));
			debug("error: " + JSON.stringify(error));
		}
		
	}

	/**
	 * start listening on port or emit graceful exit
	 * @returns true, if successful
	 */
	listen() {
		if(this.created) {
			try {
				if(_.isNumber(this.options.port)) {
					this.server.listen(this.options.port);
					debug("listening on port " + this.options.port);
					return true;
				} else {
					const msg = "port ist not a number: " + this.options.port;
					const error = new Error(msg);

					debug(msg);
					this.emit("gracefulexit", [error]);
					debug("emitted gracefulexit");
					return false;
				}
			} catch(error) {
				debug("unable to listen to port " + this.options.port);
				this.emit("gracefulexit", [error]);
				debug("emitted gracefulexit");
				return false;
			}
		} else {
			debug("cannot listen. server not created");
			this.emit("gracefulexit", [new Error("server not created")]);
			debug("emitted gracefulexit");
			return false;
		}
	}

	/**
	 * close server and call back
	 * @param {Function} callback 
	 */
	close(callback) {
		if(this.created) {
			debug("closing ...");
			this.server.close(callback);
		} else {
			debug("cannot close server. server not created");
			callback(new Error("cannot close server"));
		}
	}

};