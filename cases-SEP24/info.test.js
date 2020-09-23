import getTomlFile from "../util/getTomlFile";
import { fetch } from "../util/fetchShim";
import { infoSchema } from "./util/schema";
import { ensureCORS } from "../util/ensureCORS";
import { loggableFetch } from "../util/loggableFetcher";

jest.setTimeout(30000);

const urlBuilder = new URL(process.env.DOMAIN);
const url = urlBuilder.toString();

describe("Info", () => {
  let toml;
  let transferServer;
  let horizonURL;
  beforeAll(async () => {
    try {
      toml = await getTomlFile(url);
    } catch (e) {
      throw "Invalid TOML formatting";
    }
    try {
      horizonURL =
        process.env.MAINNET === "true" || process.env.MAINNET === "1"
          ? "https://horizon.stellar.org"
          : "https://horizon-testnet.stellar.org";
    } catch (e) {
      throw "horizonURL cannot be set";
    }
  });

  it("has a TRANSFER_SERVER or TRANSFER_SERVER_SEP0024 url in the toml", () => {
    transferServer = toml.TRANSFER_SERVER_SEP0024 || toml.TRANSFER_SERVER;
    expect(transferServer).toEqual(expect.stringContaining("http"));
    expect(() => new URL(transferServer)).not.toThrow();
  });

  it("has CORS on the info endpoint", async () => {
    const { optionsCORS, otherVerbCORS, logs } = await ensureCORS(
      transferServer + "/info",
    );
    expect(optionsCORS, logs).toBe("*");
    expect(otherVerbCORS, logs).toBe("*");
  });

  it("has home_domain set in the issuer account", async () => {
    const query = horizonURL + `/accounts/${toml.CURRENCIES[0].issuer}`;
    const { json, status, logs } = await loggableFetch(query);
    expect(status, logs).toEqual(200);
    expect(toml.TRANSFER_SERVER).toEqual(
      expect.stringContaining(json.home_domain),
    );
  });

  describe("happy path", () => {
    let json;

    beforeAll(async () => {
      const response = await fetch(transferServer + "/info", {
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
      expect(json).toMatchSchema(infoSchema);
    });
  });
});
