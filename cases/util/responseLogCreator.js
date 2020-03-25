
export const createLog = (response) => {
  
  var log = "\nSTATUS: " + response.status;
  log += "\nHEADERS: " + JSON.stringify(response.headers.raw(), null, 2);
  log += "\nBODY: " + JSON.stringify(response.body, null, 2);
  
  return log;
}