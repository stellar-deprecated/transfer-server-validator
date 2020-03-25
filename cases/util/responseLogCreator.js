
export const createLog = (response, responseBody) => {
  
  const rawHeaders = response.headers.raw();
  const formattedHeaders = Object.keys(rawHeaders).map(key => `${key}: ${rawHeaders[key]}`).join("\n")
  
  var log = "\nRESPONSE ⬇️"
  log += "\nSTATUS: " + response.status;
  log += "\n\nHEADERS:\n" + formattedHeaders;
  log += "\n\nBODY:\n" + JSON.stringify(responseBody, null, 2);
  
  return log;
}