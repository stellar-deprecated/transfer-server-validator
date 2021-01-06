import { fetch } from "../../util/fetchShim";
import { getSep10Token } from "../../util/sep10";
import { keyPair } from "./registeredKeypair";
export const getActiveCurrency = async (testCurrency, server, domain) => {
  const infoResponse = await fetch(server + "/info", {
    headers: {
      Origin: "https://www.website.com",
    },
  });
  const infoJSON = await infoResponse.json();

  const currenciesDictionary = infoJSON.receive;
  const currencies = Object.keys(infoJSON.receive);

  const enabledCurrency = testCurrency
    ? testCurrency
    : currencies.find((currency) => currenciesDictionary[currency].enabled);

  return { enabledCurrency, infoJSON, currencies };
};
