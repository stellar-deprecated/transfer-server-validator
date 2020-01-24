import { fetch } from "./fetchShim";

export default async function friendbot(address) {
  const response = await fetch(
    `https://friendbot.stellar.org/?addr=${address}`
  );
  expect(response.status).toEqual(200);
  const json = await response.json();
}
