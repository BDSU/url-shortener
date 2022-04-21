jest.setTimeout(30000);

const request = require("supertest");

const {
	expectRedirect,
	expectBadRequest
} = require("./helper/expectfn.js");

const Router = require("../src/api/router.js");
const DataManager = require("../src/persistence/instance.js");
const CONFIG = require("../src/config/config.js");

// --------------------------------------------------------------------
// test suite
// --------------------------------------------------------------------

describe("url-shortener - oauth", () => {

	// --------------------------------------------------------------------
	// setup
	// --------------------------------------------------------------------

	var datamanager = new DataManager(CONFIG.mongo).getInstance();
	var app = new Router(datamanager).getAppRouter();

	// connect to database before running tests
	beforeAll(async () => {
		await datamanager.connect();
	});
	
	// --------------------------------------------------------------------
	// tests
	// --------------------------------------------------------------------

	describe("GET\t/oauth", () => {

		test("valid request with token", async () => {
			const res = await request(app)
				.get("/oauth")
				.set("Cookie", ["aad-token=valid-user"])
				.send();
			expectRedirect(res);
		});

		test("valid request without token", async () => {
			const res = await request(app)
				.get("/oauth")
				.send();
			expectRedirect(res);
		});

		test("valid request with invalid token", async () => {
			const res = await request(app)
				.get("/oauth")
				.set("Cookie", ["aad-token=invalid-user"])
				.send();
			expectRedirect(res);
		});
	
	});

	describe("GET\t/oauth/callback", () => {

		test("invalid request: missing query parameters", async () => {
			const res = await request(app)
				.get("/oauth/callback")
				.send();
			expectBadRequest(res);
		});

		test("invalid request: invalid query parameter code", async () => {
			const queryParams = "?code=0.AToAPxHz-n1dlEwW7VHbpMnbcUmoaTEnwKlNps1zzJ47zJk6AMY.AQABAAIAAAD--DLA3VO7QrddgJg7WevrQ_qqd4IV172_ERSryswvqviCaLm-8ShvcoNGPSYzv-Xyb8OQPQG0PNgTSowRJrddACPpDbK_xecwEZo__oGT8NjI2Yhf5GhFqP3LRcW9n2pFApjxiI2vdkH-DCLD5EmcQ3Br3ZB3hKMwo7VowGZLpav1JHf10KNYRjmEhkY9A6d8FvN47SUFvV7clnt3D3SbylgqAIHgJ22SJw4MUBuRW_2JYlNQx1WZaQjALTrN6aWCOsLc5PTVr0ioQ_w5kIJ_JwjBj4DQ7FN1RqRGGOWUglzg0Dyt_qOKqjEiJrdhYaFsSOehLlr7-P7V6354gY3lo8UAB6_YdT-titpEmnwCCd-umqI6qu9w1Op15h6ekYjtVNCmeodaUHKusNi7kpRf7iRsOaDi7TrBxnQo-IguZ8M_lai1_9rPByZaMMABHfLz8iulU0WUjEsIon4X8FZQh0jpGAOUecTbHnUVviE3eRPLsdt8iho9nEI4EXMXFE2cSvqXFguW1jGImQx4YMTDWP6gFDEdAoNfOWf1q_PyZwe9WAsRrPwFYXd3-wuTKLHsv1v8IWyQ4pJB9A2ZbXYKt2Y8tUHAhOuEFCVfYf3-Y7CSnaYe1ggdqBtMcnJpuyrG_ESDF73qUFYD7us16Lq6yYW46fFaas7YgnpIvnwMoeyKRPRUQNPm2r7eIzI1vbAgAA&state=&session_state=8c14c6f1-c727-41c6-b59e-f0050c137369#";
			const res = await request(app)
				.get("/oauth/callback" + queryParams)
				.send();		
			expectBadRequest(res);
		});

		test("invalid request: outdated", async () => {
			const queryParams = "?code=0.AToAPxHz-n1dlEWW7VHbpMnbcUmoaTEnwKlNps1zzJ47zJk6AMY.AQABAAIAAAD--DLA3VO7QrddgJg7WevrQ_qqd4IV172_ERSryswvqviCaLm-8ShvcoNGPSYzv-Xyb8OQPQG0PNgTSowRJrddACPpDbK_xecwEZo__oGT8NjI2Yhf5GhFqP3LRcW9n2pFApjxiI2vdkH-DCLD5EmcQ3Br3ZB3hKMwo7VowGZLpav1JHf10KNYRjmEhkY9A6d8FvN47SUFvV7clnt3D3SbylgqAIHgJ22SJw4MUBuRW_2JYlNQx1WZaQjALTrN6aWCOsLc5PTVr0ioQ_w5kIJ_JwjBj4DQ7FN1RqRGGOWUglzg0Dyt_qOKqjEiJrdhYaFsSOehLlr7-P7V6354gY3lo8UAB6_YdT-titpEmnwCCd-umqI6qu9w1Op15h6ekYjtVNCmeodaUHKusNi7kpRf7iRsOaDi7TrBxnQo-IguZ8M_lai1_9rPByZaMMABHfLz8iulU0WUjEsIon4X8FZQh0jpGAOUecTbHnUVviE3eRPLsdt8iho9nEI4EXMXFE2cSvqXFguW1jGImQx4YMTDWP6gFDEdAoNfOWf1q_PyZwe9WAsRrPwFYXd3-wuTKLHsv1v8IWyQ4pJB9A2ZbXYKt2Y8tUHAhOuEFCVfYf3-Y7CSnaYe1ggdqBtMcnJpuyrG_ESDF73qUFYD7us16Lq6yYW46fFaas7YgnpIvnwMoeyKRPRUQNPm2r7eIzI1vbAgAA&state=&session_state=8c14c6f1-c727-41c6-b59e-f0050c137369#";
			const res = await request(app)
				.get("/oauth/callback" + queryParams)
				.send();	
			expectBadRequest(res);
		});

		test("invalid request: invalid query parameter session_state", async () => {
			const queryParams = "?code=0.AToAPxHz-n1dlEWW7VHbpMnbcUmoaTEnwKlNps1zzJ47zJk6AMY.AQABAAIAAAD--DLA3VO7QrddgJg7WevrQ_qqd4IV172_ERSryswvqviCaLm-8ShvcoNGPSYzv-Xyb8OQPQG0PNgTSowRJrddACPpDbK_xecwEZo__oGT8NjI2Yhf5GhFqP3LRcW9n2pFApjxiI2vdkH-DCLD5EmcQ3Br3ZB3hKMwo7VowGZLpav1JHf10KNYRjmEhkY9A6d8FvN47SUFvV7clnt3D3SbylgqAIHgJ22SJw4MUBuRW_2JYlNQx1WZaQjALTrN6aWCOsLc5PTVr0ioQ_w5kIJ_JwjBj4DQ7FN1RqRGGOWUglzg0Dyt_qOKqjEiJrdhYaFsSOehLlr7-P7V6354gY3lo8UAB6_YdT-titpEmnwCCd-umqI6qu9w1Op15h6ekYjtVNCmeodaUHKusNi7kpRf7iRsOaDi7TrBxnQo-IguZ8M_lai1_9rPByZaMMABHfLz8iulU0WUjEsIon4X8FZQh0jpGAOUecTbHnUVviE3eRPLsdt8iho9nEI4EXMXFE2cSvqXFguW1jGImQx4YMTDWP6gFDEdAoNfOWf1q_PyZwe9WAsRrPwFYXd3-wuTKLHsv1v8IWyQ4pJB9A2ZbXYKt2Y8tUHAhOuEFCVfYf3-Y7CSnaYe1ggdqBtMcnJpuyrG_ESDF73qUFYD7us16Lq6yYW46fFaas7YgnpIvnwMoeyKRPRUQNPm2r7eIzI1vbAgAA&state=&session_state=8c14c6f1-c727-41c6-b59e-f0050c137360#";
			const res = await request(app)
				.get("/oauth/callback" + queryParams)
				.send();
			expectBadRequest(res);
		});
	
	});

	// --------------------------------------------------------------------
	// tear down
	// --------------------------------------------------------------------

	afterAll(async () => {
		await datamanager.drop();
		await datamanager.close();
	});

});