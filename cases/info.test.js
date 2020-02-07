import { fetch } from "./util/fetchShim";
import TOML from "toml";

const urlBuilder = new URL(process.env.DOMAIN);
const url = urlBuilder.toString();
describe("Info", () => {
  let toml;
  let TRANSFER_SERVER;
  beforeAll(async () => {
    const response = await fetch(url + ".well-known/stellar.toml");
    const text = await response.text();
    try {
      toml = TOML.parse(text);
      TRANSFER_SERVER = toml.TRANSFER_SERVER;
      if (TRANSFER_SERVER[TRANSFER_SERVER.length - 1] !== "/") {
        TRANSFER_SERVER += "/";
      }
    } catch (e) {
      throw "Invalid TOML formatting";
    }
  });

  it("has a TRANSFER_SERVER url in the toml", () => {
    expect(TRANSFER_SERVER).toEqual(expect.stringContaining("http"));
    expect(() => new URL(TRANSFER_SERVER)).not.toThrow();
  });

  it("has CORS on the info endpoint", async () => {
    const response = await fetch(TRANSFER_SERVER + "info", {
      headers: {
        Origin: "https://www.website.com"
      }
    });
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });

  describe("happy path", () => {
    let json;

    beforeAll(async () => {
      const response = await fetch(TRANSFER_SERVER + "info", {
        headers: {
          Origin: "https://www.website.com"
        }
      });
      expect(response.status).toEqual(200);
      expect(response.headers.get("content-type")).toEqual(
        expect.stringContaining("application/json")
      );
      json = await response.json();
      expect(json).toBeTruthy();
    });

    it("has a proper schema", () => {
      const depositAndWithdrawSchema = {
        type: "object",
        patternProperties: {
          ".*": {
            properties: {
              enabled: { type: "boolean" },
              fee_fixed: { type: "number" },
              fee_percent: { type: "number" },
              min_amount: { type: "number" },
              max_amount: { type: "number" }
            }
          }
        }
      };
      const schema = {
        properties: {
          deposit: depositAndWithdrawSchema,
          withdraw: depositAndWithdrawSchema,
          fee: {
            properties: { enabled: { type: "boolean" } }
          }
        }
      };
      expect(json).toMatchSchema(schema);
    });
  });
});
