
export const createLog = (requestURL, requestDictionary, response, responseBody) => {
  
  const rawHeaders = response.headers.raw();
  const formattedHeaders = Object.keys(rawHeaders).map(key => `${key}: ${rawHeaders[key]}`).join("\n")

  const requestMethod = requestDictionary["method"] ? requestDictionary["method"] : "GET";

  const log = `
  \n -----------------------------
  \n⬇️ REQUEST ⬇️
  \nURL: ${requestURL}
  \nMETHOD: ${requestMethod}
  \nHEADERS: \n${JSON.stringify(requestDictionary["headers"], null, 2)}
  \nBODY: \n${JSON.stringify(requestDictionary["body"], null, 2)}
  
  \n⬇️ RESPONSE ⬇️
  \nSTATUS: ${response.status}
  \nHEADERS: \n${formattedHeaders}
  \nBODY: \n${JSON.stringify(responseBody, null, 2)}
  \n -----------------------------`;
  
  return log;
}