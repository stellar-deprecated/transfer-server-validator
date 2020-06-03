import { fetch } from "../../util/fetchShim";

export const getActiveCurrency = async (testCurrency, server) => {
  const infoResponse = await fetch(server + "/info", {
    headers: {
      Origin: "https://www.website.com",
    },
  });
  const infoJSON = await infoResponse.json();
  console.log("INTERNAL JSON", infoJSON);

  const currenciesDictionary = infoJSON.send;
  const currencies = Object.keys(infoJSON.send);

  const enabledCurrency = testCurrency
    ? testCurrency
    : currencies.find((currency) => currenciesDictionary[currency].enabled);

  return { enabledCurrency, infoJSON, currencies };
};
