import { fetch } from "../../util/fetchShim";
import TOML from "toml";

export default async function(domain) {
  let response = await fetch(domain + ".well-known/stellar.toml");
  const text = await response.text();
  const toml = TOML.parse(text);
  // Remove trailing slashes for consistency in building URLs
  if (
    toml.DIRECT_PAYMENT_SERVER[toml.DIRECT_PAYMENT_SERVER.length - 1] === "/"
  ) {
    toml.DIRECT_PAYMENT_SERVER = toml.DIRECT_PAYMENT_SERVER.slice(0, -1);
  }
  expect(toml).toBeDefined();
  return toml;
}
