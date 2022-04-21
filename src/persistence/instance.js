const DataManager = require("./datamanager.js");

// --------------------------------------------------------------------
// public singleton
// --------------------------------------------------------------------

module.exports = class Singleton {
	
	/**
	 * create singleton for DataManager
	 * @param {Object} opts 
	 */
	constructor(opts) {
		if(!this.instance) {
			this.instance = new DataManager(opts);
		}
	}

	/**
	 * get instance of DataManager
	 * @returns DataManager
	 */
	getInstance() {
		return this.instance;
	}

};