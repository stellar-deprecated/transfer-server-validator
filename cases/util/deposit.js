import { fetch } from "./fetchShim";
import getTomlFile from "./getTomlFile";
import getSep10Token from "./sep10";
export default async function(domain, keyPair) {
  const toml = await getTomlFile(domain);
  const jwt = await getSep10Token(domain, keyPair);
  return toml;
}
