import { fetch } from "./util/fetchShim";
import getTomlFile from "./util/getTomlFile";
import { infoSchema } from "./util/schema";

jest.setTimeout(30000);

const urlBuilder = new URL(process.env.DOMAIN);
const url = urlBuilder.toString();

describe("Info", () => {
  let toml;
  beforeAll(async () => {
    try {
      toml = await getTomlFile(url);
    } catch (e) {
      throw "Invalid TOML formatting";
    }
  });

  it("has a TRANSFER_SERVER url in the toml", () => {
    expect(toml.TRANSFER_SERVER).toEqual(expect.stringContaining("http"));
    expect(() => new URL(toml.TRANSFER_SERVER)).not.toThrow();
  });

  it("has CORS on the info endpoint", async () => {
    const response = await fetch(toml.TRANSFER_SERVER + "/info", {
      headers: {
        Origin: "https://www.website.com",
      },
    });
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });

  describe("happy path", () => {
    let json;

    beforeAll(async () => {
      const response = await fetch(toml.TRANSFER_SERVER + "/info", {
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
