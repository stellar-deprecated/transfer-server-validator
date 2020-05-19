import { fetch } from "../../util/fetchShim";

export async function getTransactionBy({
  value,
  toml,
  jwt,
  iden = "id",
  expectStatus = 200,
  expectStatusBetween = null,
} = {}) {
  const transferServer = toml.TRANSFER_SERVER_SEP0024 || toml.TRANSFER_SERVER;
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
