import { fetch } from "./fetchShim";

export const ensureCORS = async (URL, httpVerb) => {
   
    var optionsResponse = await fetch(URL, {
        method: "OPTIONS",
        headers: {
          Origin: "https://www.website.com",
        },
      });
    const optionsCORS = optionsResponse.headers.get("access-control-allow-origin");

    var otherVerbResponse = await fetch(URL, {
        method: httpVerb,
        headers: {
          Origin: "https://www.website.com",
        },
      });
    const otherVerbCORS = otherVerbResponse.headers.get("access-control-allow-origin");

    const logs = "In order for browsers-based wallets to validate the CORS headers, as specified by W3C, the preflight request (OPTIONS request) must be implemented in all the endpoints that support Cross-Origin."

    return {optionsCORS,  otherVerbCORS, logs};
}