const debug = require("debug")("url-shortener:middleware:validation");
const {
	validationResult,
	param,
	body
} = require("express-validator");


module.exports = {
	validateKeyParam: function() {
		return [
			param("key").exists().isString().withMessage("is required").bail().isLength({ min: 2, max: 16 }).withMessage("must be 2 - 16 characters").isAlphanumeric().withMessage("must be alphanumeric")
		];
	},
	validateUrlBody: function() {
		return [
			body("key").optional().isString().isLength({ min: 2, max: 16 }).withMessage("must be 2 - 16 characters").isAlphanumeric().withMessage("must be alphanumeric"),
			body("longurl").exists().isString().withMessage("is required").bail().isURL().withMessage("must be url"),
			body("persistent").optional().isBoolean().withMessage("must be boolean")
		];
	},
	validateUpdatedUrlBody: function() {
		return [
			body("longurl").optional().isString().withMessage("is required").bail().isURL().withMessage("must be url"),
			body("persistent").optional().isBoolean().withMessage("must be boolean")
		];
	},
	getValidationErrors: async function(req, res, next) {
		res.locals.errors = validationResult(req);
		debug("found " + (res.locals.errors.errors.length || 0) + " validation error(s)");
		next();
	}
};