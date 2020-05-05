import { fetch } from "./fetchShim";

export const getActiveCurrency = async (
  testCurrency,
  transferServer,
  isDeposit = true,
) => {
  const infoResponse = await fetch(transferServer + "/info", {
    headers: {
      Origin: "https://www.website.com",
    },
  });
  const infoJSON = await infoResponse.json();

  const currenciesDictionary = isDeposit ? infoJSON.deposit : infoJSON.withdraw;
  const currencies = Object.keys(currenciesDictionary);

  const enabledCurrency = testCurrency
    ? testCurrency
    : currencies.find((currency) => currenciesDictionary[currency].enabled);

  return { enabledCurrency, infoJSON, currencies };
};
