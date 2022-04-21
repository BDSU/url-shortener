const debug = require("debug")("url-shortener:config");
debug("preparing configuration ...");
const process = require("process");

const dotenv = require("dotenv");
const _ = require("lodash");
const assert = require("assert");
const delay = require("delay");


// --------------------------------------------------------------------
// static
// --------------------------------------------------------------------

const configFiles = {
	"test": "./test.config.json",
	"development": "./dev.config.json",
	"production": "./prod.config.json",
	"credentials": "./src/config/.app.env"
};

const dotenvRes = dotenv.config({
	path: configFiles.credentials
});

// --------------------------------------------------------------------
// validation
// --------------------------------------------------------------------

function validateProcessArgs() {
	assert(process.argv.length != undefined);
	assert(["production", "development", "test"].includes(process.env.NODE_ENV));
}

function validateConfigFile(json) {

	assert(_.isObject(json));

	// webserver
	assert(_.isObject(json.server));

	assert(_.isString(json.server.host));
	assert(json.server.host.length > 0);

	assert(_.isNumber(json.server.port));
	assert(json.server.port >= 1024); // allow not privileged ports

	assert(_.isObject(json.server.ssl));
	assert(_.isBoolean(json.server.ssl.active));

	assert(_.isString(json.server.ssl.key));
	assert(json.server.ssl.key.length > 0);

	assert(_.isString(json.server.ssl.cert));
	assert(json.server.ssl.cert.length > 0);

	// app
	assert(_.isObject(json.app));
	assert(_.isBoolean(json.app.tracking));

	assert(_.isNumber(json.app.cleanInterval));
	assert(json.app.cleanInterval >= 0);

	assert(_.isNumber(json.app.entryMaxAge));
	assert(json.app.entryMaxAge > 0);

	// mongo db server
	assert(_.isObject(json.mongo));

	assert(_.isNumber(json.mongo.port));
	assert(json.mongo.port > 0);

	assert(_.isString(json.mongo.host));
	assert(json.mongo.host.length > 0);

	assert(_.isString(json.mongo.database));
	assert(json.mongo.database.length > 0);

	assert(_.isObject(json.mongo.collections));

	for(var key in json.mongo.collections) {
		assert(_.isString(json.mongo.collections[key]));
		assert(json.mongo.collections[key].length > 0);
	}

	assert(_.isString(json.mongo.authSource));
	assert(json.mongo.authSource.length > 0);

	debug("json configuration validated");
}

function validateEnvCredentials(env) {

	assert(!_.isUndefined(env));
	assert(_.isObject(env));

	// oauth
	assert(!_.isUndefined(env.oauth));
	assert(_.isObject(env.oauth));

	assert(_.isString(env.oauth.appid));
	assert(env.oauth.appid.length > 0);

	assert(_.isString(env.oauth.tenantid));
	assert(env.oauth.tenantid.length > 0);

	assert(_.isString(env.oauth.secret));
	assert(env.oauth.secret.length > 0);

	assert(_.isString(env.oauth.appobjectid));
	assert(env.oauth.appobjectid.length > 0);

	assert(_.isString(env.oauth.redirecturi));
	assert(env.oauth.redirecturi.length > 0);

	// mongo

	assert(!_.isUndefined(env.mongo));
	assert(_.isObject(env.mongo));

	assert(_.isString(env.mongo.user));
	assert(env.mongo.user);

	assert(_.isString(env.mongo.password));
	assert(env.mongo.password);
	
	debug("env configuration validated");
}

// --------------------------------------------------------------------
// environment
// --------------------------------------------------------------------

function getEnvCredentials() {
	const cred = {
		mongo: {
			user: process.env.MONGO_API_USER,
			password: process.env.MONGO_API_USER_PASS
		},
		oauth: {
			appid: process.env.AAD_OAUTH_CLIENT_ID,
			appobjectid: process.env.AAD_OAUTH_APP_OBJECT_ID,
			tenantid: process.env.AAD_OAUTH_TENANT_ID,
			secret: process.env.AAD_OAUTH_APP_SECRET,
			redirecturi: process.env.AAD_OAUTH_REDIRECT_URI
		}
	};
	debug(configFiles.credentials + " parsed");
	return cred;
}

function removeCredentialsFromEnv() {
	delete process.env.MONGO_API_USER;
	delete process.env.MONGO_API_USER_PASS;
	delete process.env.AAD_OAUTH_CLIENT_ID;
	delete process.env.AAD_OAUTH_APP_OBJECT_ID;
	delete process.env.AAD_OAUTH_TENANT_ID;
	delete process.env.AAD_OAUTH_APP_SECRET;
	debug("removed credentials from environment");
}

// --------------------------------------------------------------------
// NODE_ENV
// --------------------------------------------------------------------

validateProcessArgs();
debug("NODE_ENV=" + process.env.NODE_ENV);

// --------------------------------------------------------------------
// configuration files
// --------------------------------------------------------------------

if(!dotenvRes.parsed) {
	const msg = configFiles.credentials + " not found";
	// eslint-disable-next-line no-console
	console.error(msg);
	delay(500);
	process.exit(1);
}

// load and delete credentials from process environment
var env = getEnvCredentials();
removeCredentialsFromEnv();

var json;
switch(process.env.NODE_ENV) {
case "test":
	json = require(configFiles.test);
	debug(configFiles.test + " parsed");
	break;
case "development":
	json = require(configFiles.development);
	debug(configFiles.development + " parsed");
	break;
default:
	json = require(configFiles.production);
	debug(configFiles.production + " parsed");
	break;
}

validateConfigFile(json);
validateEnvCredentials(env);

module.exports = {
	server: json.server,
	app: {
		tracking: json.app.tracking,
		oauth: env.oauth,
		entryMaxAge: json.app.entryMaxAge,
		cleanInterval: json.app.cleanInterval
	},	
	mongo: {
		server: json.mongo,
		credentials: env.mongo,
	}
};

debug("configuration prepared successfully");