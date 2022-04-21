const debug = require("debug")("url-shortener:index");
const process = require("process");

debug("date: " + new Date().toLocaleDateString());
debug("node version: " + process.version);

const Controller = require("./api/controller.js");
new Controller();