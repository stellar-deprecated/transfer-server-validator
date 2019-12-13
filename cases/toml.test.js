import { fetch } from "../util";
import TOML from "toml";

const url = "https://www.stellar.org";
describe("TOML File", () => {
	it("exists", async () => {
		const response = await fetch(url + "/.well-known/stellar.toml");
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("text/plain");
	});

	it("has cors", async () => {
		const response = await fetch(url + "/.well-known/stellar.toml", {
			method: "OPTIONS"
		});
		expect(response.headers.get("access-control-allow-origin")).toBe("*");
	});

	describe("fields", () => {
		let toml;
		beforeAll(async () => {
			const response = await fetch(url + "/.well-known/stellar.toml");
			const text = await response.text();
			try {
				toml = TOML.parse(text);
			} catch (e) {
				throw "Invalid TOML formatting";
			}
		});

		it("is well formatted", async () => {});

		it("has a network passphrase", () => {
			expect(toml.NETWORK_PASSPHRASE).toBeTruthy();
		});

		it("has issuer documentation", () => {
			expect(toml.DOCUMENTATION).toEqual(
				expect.objectContaining({
					ORG_NAME: expect.any(String),
					ORG_URL: expect.any(String)
				})
			);
		});
	});
});
