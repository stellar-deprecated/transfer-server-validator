import { fetch } from "./fetchShim";
import TOML from "toml";

export default async function(domain) {
  let response = await fetch(domain + ".well-known/stellar.toml");
  const text = await response.text();
  const toml = TOML.parse(text);
  expect(toml).toBeDefined();
  return toml;
}
