import { fetch } from "../util/fetchShim";
import getTomlFile from "./util/getTomlFile";
import { infoSchema } from "./util/schema";
import { ensureCORS } from "../util/ensureCORS";

jest.setTimeout(30000);

const urlBuilder = new URL(process.env.DOMAIN);
const url = urlBuilder.toString();

describe("Info", () => {
  let toml;
  let DIRECT_PAYMENT_SERVER;
  beforeAll(async () => {
    try {
      toml = await getTomlFile(url);
    } catch (e) {
      throw "Invalid TOML formatting";
    }
  });

  it("has a DIRECT_PAYMENT_SERVER in the toml", () => {
    DIRECT_PAYMENT_SERVER = toml.DIRECT_PAYMENT_SERVER;
    expect(DIRECT_PAYMENT_SERVER).toEqual(expect.stringContaining("http"));
    expect(() => new URL(DIRECT_PAYMENT_SERVER)).not.toThrow();
  });

  it("has CORS on the info endpoint", async () => {
    const { optionsCORS, otherVerbCORS, logs } = await ensureCORS(
      DIRECT_PAYMENT_SERVER + "/info",
    );
    expect(optionsCORS, logs).toBe("*");
    expect(otherVerbCORS, logs).toBe("*");
  });

  describe("happy path", () => {
    let json;

    beforeAll(async () => {
      const response = await fetch(DIRECT_PAYMENT_SERVER + "/info", {
        headers: {
          Origin: "https://www.website.com",
        },
      });
      expect(response.status).toEqual(200);
      expect(response.headers.get("content-type")).toEqual(
        expect.stringContaining("application/json"),
      );
      json = await response.json();
      expect(json).toBeTruthy();
    });

    it("has a proper schema", () => {
      expect(json, json).toMatchSchema(infoSchema);
    });
  });
});
