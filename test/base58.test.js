jest.setTimeout(30000);

const {
	encode,
	decode,
	createRandomKey
} = require("../src/helper/base58.js");

// --------------------------------------------------------------------
// test suite
// --------------------------------------------------------------------

describe("url-shortener - base58", () => {

	// --------------------------------------------------------------------
	// setup
	// --------------------------------------------------------------------

	const testdata = [
		-99,
		-1,
		0,
		1,
		123,
		100000,
		"",
		"inval",
		true,
		false,
		{},
		[],
		"0ß1293",
		"invalidurl",
		"a.b",
		"google.c",
		"httpsinvalid://google.com"
	];

	// --------------------------------------------------------------------
	// tests
	// --------------------------------------------------------------------

	describe("encode and decode strings", () => {
		test.each(testdata)("encode & decode %s",(value) => {
			const stringVal = String(value);
			const encoded = encode(stringVal);

			expect(encoded).toBeDefined();
			expect(typeof encoded === "string");
			expect(encoded.length >= stringVal.length);

			const decoded = decode(encoded);

			expect(decoded).toBeDefined();
			expect(typeof decoded === "string");
			expect(decoded === stringVal);
		});
	});

	describe("create random keys", () => {
		const iterations = 100;
		const nrKeys = 10;

		for(var i = 0; i < iterations; i++) {
			test("create " + nrKeys + " key(s). iteration " + (i+1), async () => {
				const keys = [];
				for(var j = 0; j < nrKeys; j++) {
					const key = createRandomKey();
					expect(key).toBeDefined();
					expect(typeof key === "string").toBeTruthy();
					expect(key.length > 0).toBeTruthy();
					keys.push(key);
				}
				
				expect(keys.length === [...new Set(keys)].length);
			});
		}
	});

});