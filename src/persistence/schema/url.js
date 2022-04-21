const mongoose = require("mongoose");
const Schema = mongoose.Schema;

module.exports = new Schema(
	{
		key: {
			type: String,
			required: true
		},
		oid: {
			type: String,
			require: true
		},
		longurl: {
			type: String,
			required: true
		},
		persistent: {
			type: Boolean,
			required: true
		}
	}, { 
		timestamps: true 
	}
);