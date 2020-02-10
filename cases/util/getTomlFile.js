import { fetch } from "./fetchShim";
import TOML from "toml";

export default async function(domain) {
  let response = await fetch(domain + ".well-known/stellar.toml");
  const text = await response.text();
  const toml = TOML.parse(text);
  // Remove trailing slashes for consistency in building URLs
  if (toml.TRANSFER_SERVER[toml.TRANSFER_SERVER.length - 1] === "/") {
    toml.TRANSFER_SERVER = toml.TRANSFER_SERVER.slice(0, -1);
  }
  expect(toml).toBeDefined();
  return toml;
}
