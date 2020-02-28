import { fetch } from "./fetchShim";

export async function getTransactionBy({
  value,
  toml,
  jwt,
  iden = "id",
  expectStatusIn = [200],
  expectStatusBetween = null,
} = {}) {
  const response = await fetch(
    toml.TRANSFER_SERVER + `/transaction?${iden}=${value}`,
    {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    },
  );
  let json = await response.json();
  if (!expectStatusBetween) {
    expect(expectStatusIn).toContain(response.status);
  } else {
    let [low, high] = expectStatusBetween;
    expect(response.status).toBeGreaterThanOrEqual(low);
    expect(response.status).toBeLessThan(high);
  }
  return json;
}
