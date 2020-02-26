import { fetch } from "./fetchShim";

export async function getTransactionBy({
  value,
  toml,
  jwt,
  iden = "id",
  expectStatus = 200,
} = {}) {
  const response = await fetch(
    toml.TRANSFER_SERVER + `/transaction?${iden}=${value}`,
    {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    },
  );
  expect(response.status).toEqual(expectStatus);
  return await response.json();
}
