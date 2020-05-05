import { fetch } from "./fetchShim";

export const loggableFetch = async (requestURL, requestDictionary) => {
  const response = await fetch(requestURL, requestDictionary);
  const json = await response.json();

  const rawHeaders = response.headers.raw();
  const formattedHeaders = Object.keys(rawHeaders)
    .map((key) => `${key}: ${rawHeaders[key]}`)
    .join("\n");

  const requestMethod =
    requestDictionary && requestDictionary["method"]
      ? requestDictionary["method"]
      : "GET";
  const requestHeaders =
    requestDictionary && requestDictionary["headers"]
      ? requestDictionary["headers"]
      : undefined;
  const requestBody =
    requestDictionary && requestDictionary["body"]
      ? requestDictionary["body"]
      : undefined;

  const status = response.status;

  const logs = `
    \n -----------------------------
    \n⬇️ REQUEST ⬇️
    \nURL: ${requestURL}
    \nMETHOD: ${requestMethod}
    \nHEADERS: \n${JSON.stringify(requestHeaders, null, 2)}
    \nBODY: \n${JSON.stringify(requestBody, null, 2)}
    
    \n⬇️ RESPONSE ⬇️
    \nSTATUS: ${status}
    \nHEADERS: \n${formattedHeaders}
    \nBODY: \n${JSON.stringify(json, null, 2)}
    \n -----------------------------`;

  return { json, status, logs };
};
