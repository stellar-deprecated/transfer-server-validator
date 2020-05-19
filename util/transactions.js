import { fetch } from "./fetchShim";

export async function getTransactionBy({
  value,
  transferServer,
  jwt,
  iden = "id",
  expectStatus = 200,
  expectStatusBetween = null,
} = {}) {
  const response = await fetch(
    transferServer + `/transaction?${iden}=${value}`,
    {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    },
  );
  let json = await response.json();
  if (!expectStatusBetween) {
    expect(response.status).toBe(expectStatus);
  } else {
    let [low, high] = expectStatusBetween;
    expect(response.status).toBeGreaterThanOrEqual(low);
    expect(response.status).toBeLessThan(high);
  }
  return json;
}

export async function getLatestTransaction({
  transferServer,
  jwt,
  account,
  asset_code,
} = {}) {
  const response = await fetch(
    transferServer +
      `/transactions?asset_code=${asset_code}&account=${account}`,
    {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    },
  );
  let json = await response.json();
  console.log(json);
  return json.transactions[0];
}
