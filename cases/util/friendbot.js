import { fetch } from "./fetchShim";
import StellarSdk from "stellar-sdk";

async function friendbot(address) {
  const response = await fetch(
    `https://friendbot.stellar.org/?addr=${address}`
  );
  expect(response.status).toEqual(200);
}

export default friendbot;
