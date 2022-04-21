const { base58 } = require("micro-base");

function convertStringToByteArray(input) {
	var byteArray = [];
	for(var i = 0; i < input.length; i++){  
		byteArray.push(input.charCodeAt(i));
	}
	return Uint8Array.from(byteArray);
}

function convertByteArrayToString(array) {
	var string = "";
	for(var i = 0; i < array.length; i++) {
		string += String.fromCharCode(array[i]);
	}
	return string;
}

/**
 * base58 encode a string
 * @param {*} input 
 * @returns 
 */
function encode(input) {
	input = String(input);
	var bytes = convertStringToByteArray(input);
	return base58.encode(bytes);
}

/**
 * decode a base58 string
 * @param {*} input 
 * @returns 
 */
function decode(input) {
	input = String(input);
	var bytes = base58.decode(input);
	return convertByteArrayToString(bytes);
}

module.exports = {
	encode: encode,
	decode: decode,
	/**
	 * create randomized key encoded in Base58
	 * @returns 
	 */
	createRandomKey: function() {
		const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
		const MIN_LENGTH = 7;
		const MAX_LENGTH = 32;

		const fixedLength = MIN_LENGTH + Math.random() * (MAX_LENGTH - MIN_LENGTH);
		var result = "";

		for(var i = 0; i < fixedLength; i++) {
			result += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length));
		}
		
		return encode(result);
	}
};