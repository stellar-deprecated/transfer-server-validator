import getTomlFile from "./util/getTomlFile";
import { loggableFetch } from "../util/loggableFetcher";
import { infoSchema } from "./util/schema";
import { ensureCORS } from "../util/ensureCORS";
import { keyPair } from "./util/registeredKeypair";

jest.setTimeout(30000);

const urlBuilder = new URL(process.env.DOMAIN);
const url = urlBuilder.toString();

describe("Info", () => {
  let toml;
  let jwt;
  let DIRECT_PAYMENT_SERVER;
  beforeAll(async () => {
    toml = await getTomlFile(url);
    DIRECT_PAYMENT_SERVER = toml.DIRECT_PAYMENT_SERVER;
  });

  it("has a DIRECT_PAYMENT_SERVER in the toml", () => {
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
    let json, logs;

    beforeAll(async () => {
      const response = await loggableFetch(DIRECT_PAYMENT_SERVER + "/info", {
        headers: {
          Origin: "https://www.website.com",
          Authorization: `Bearer ${jwt}`,
        },
      });
      json = response.json;
      logs = response.logs;
      expect(response.status).toEqual(200);
      expect(json).toBeTruthy();
    });

    it("has a proper schema", () => {
      expect(json, logs).toMatchSchema(infoSchema);
    });
  });
});
