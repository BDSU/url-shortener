const mongoose = require("mongoose");
const Schema = mongoose.Schema;

module.exports = new Schema(
	{
		key: {
			type: String,
			required: true
		},
		userId: {
			type: String,
			required: false
		},
	},
	{ 
		timestamps: true 
	}
);