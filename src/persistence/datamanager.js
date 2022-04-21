const debug = require("debug")("url-shortener:datamanager");
const mongoose = require("mongoose");

const urlSchema = require("./schema/url.js");
const statSchema = require("./schema/stat.js");

const base58 = require("../helper/base58.js");

// --------------------------------------------------------------------
// private class
// --------------------------------------------------------------------

module.exports = class DataManager {


	/**
	 * create database client for mongo db
	 * @param {Object} opts connection details
	 */
	constructor(opts) {
		debug("initializing datamanager ...");
		this._setConnected(false);

		this.opts = opts;
		
		// initialize models
		this.Url = mongoose.model("Url", urlSchema);
		this.Stat = mongoose.model("Stat", statSchema);

		debug("datamanager initialized");
	}

	/**
	 * establish connection to database server
	 */
	async connect() {
		var url = "mongodb://" + this.opts.server.host + ":" + this.opts.server.port + "/" + this.opts.server.database + "?authSource=" + this.opts.server.authSource;
		debug("connection url: " + url);

		mongoose.connection.on("connecting", () => {
			debug("starting database connection ...");
		});

		return await mongoose.connect(url, {
			user: this.opts.credentials.user,
			pass: this.opts.credentials.password,
			minPoolSize: 1,
			maxPoolSize: 25,
			heartbeatFrequencyMS: 3000,
			serverSelectionTimeoutMS: 7000
		}).then(() => {
			debug("database connection established");
			this._setConnected(true);
		});
	}

	/**
	 * close connection
	 * @returns Promise
	 */
	async close() {
		debug("closing ...");
		this._setConnected(false);
		return await mongoose.disconnect();
	}

	/**
	 * check database access
	 * @returns Promise
	 */
	check() {
		return this.Url.findOne().then(() => {
			debug("database access checked successfully");
			return Promise.resolve();
		}).catch(error => {
			debug("unable to access database");
			return Promise.reject(error);
		});
	}

	/**
	 * drop database
	 */
	async drop() {
		if(mongoose.connection.readyState == mongoose.STATES["connected"]) {
			return await mongoose.connection.db.dropDatabase()
				.then((res) => {
					if(res === true) {
						const msg = "dropped database " + this.opts.server.database + ": " + res;
						debug(msg);
						return Promise.resolve(msg);
					} else {
						const msg = "failed to drop database " + this.opts.server.database + ": " + res;
						debug(msg);
						return Promise.reject(msg);
					}
				});
		} else {
			const msg = "not connected. unable to drop database " + this.opts.server.database;
			debug(msg);
			return Promise.reject(msg);
		}
	}

	/**
	 * create 3 random base58 hashs and check database for key collisions
	 * use first available key
	 */
	createKey() {
		var promises = [];
		for(var i = 0; i < 10; i ++) {
			var tmpKey = base58.createRandomKey().substr(0, 7);
			var promise = this.findEntry(tmpKey).then(result => {
				return (result == null ? tmpKey : undefined);
			});
			promises.push(promise);
		}
		
		return Promise.any(promises).then((result) => {
			if(!result) {
				return Promise.reject("unable to create unique key");
			} else {
				return Promise.resolve(result);
			}
		});
	}

	/**
	 * find and return all entries
	 * @returns Promise
	 */
	findAllEntries() {
		return this.Url.find({});
	}

	/**
	 * find and return entry with key
	 * @param key 
	 * @returns Promise
	 */
	findEntry(key) {
		return this.Url.findOne({ key: key });
	}

	/**
	 * add new entry to url collection
	 * @param entry 
	 * @returns Promise
	 */
	addEntry(entry) {
		var url = new this.Url({
			key: entry.key,
			oid: entry.oid,
			longurl: entry.longurl,
			persistent: entry.persistent
		});

		return url.save();
	}

	/**
	 * add caller info to stat collection
	 * @param info 
	 * @returns Promise
	 */
	addCall(info) {
		var stat = new this.Stat(info);
		return stat.save();
	}

	/**
	 * update properties of entry
	 * @param props 
	 * @returns Promise
	 */
	updateEntry(key, props) {
		return this.Url.findOneAndUpdate({ key: key }, props);
	}

	/**
	 * delete entry with key
	 * @param key 
	 * @returns Promise
	 */
	deleteEntry(key) {
		return this.Url.deleteOne({ key: key });
	}

	/**
	 * delete caller statistics of entry with key
	 * @param key 
	 * @returns Promise
	 */
	deleteCalls(key) {
		return this.Stat.deleteMany({ key: key });
	}

	/**
	 * get date and number of calls per date since creation of entry
	 * @param key 
	 * @returns Promise
	 */
	findCallsPerDateStatistic(key) {
		return this.Stat.aggregate([
			{ 
				$match: {
					key: key
				},
			},
			{
				$group: {
					_id: {
						$dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
					},
					count: {
						$sum: 1
					}
				}
			}
		]);
	}

	/**
	 * get number of unique users of entry
	 * @param key 
	 * @returns Promise
	 */
	findUniqueCallersStatistic(key) {
		return this.Stat.aggregate([
			{ 
				$match: {
					key: key
				},
			},
			{
				$group: {
					_id: {
						ip: "$ip",
						useragent: "$useragent"
					},
					calls: {
						$sum: 1
					}
				}
			}
		]);
	}

	/**
	 * get entries, which are not persistent and older maxAgeMinutes
	 * @param maxAgeMinutes maximum age of entries in minutes
	 * @returns Promise
	 */
	findExpiredEntries(maxAgeMinutes) {
		const now = new Date();
		debug("find expired entries before " + new Date(now - (1000 * 60 * maxAgeMinutes)).toISOString());
		return this.Url.find({
			persistent: false,
			createdAt : {
				$lte : new Date(now - (1000 * 60 * maxAgeMinutes))
			}
		});
	}

	/**
	 * delete entries by keys
	 * @param keys array of keys
	 * @returns Promise
	 */
	deleteExpiredEntries(keys) {
		if(keys.length > 0) {
			return this.Url.deleteMany({
				key: {
					$in: keys
				}
			});
		} else {
			return Promise.resolve({ deletedCount: 0 });
		}
	}

	/**
	 * delete calls of entries with keys
	 * @param keys array of keys
	 * @returns Promise
	 */
	deleteCallsOfExpiredEntries(keys) {
		if(keys.length > 0) {
			return this.Stat.deleteMany({
				key: {
					$in: keys
				}
			});
		} else {
			return Promise.resolve({ deletedCount: 0 });
		}
	}

	/**
	 * set connection status
	 * @param bool boolean
	 */
	_setConnected(bool) {
		if(typeof bool == "boolean") {
			this.connected = bool;
		}
	}
};