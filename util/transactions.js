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

export async function resubmitOnRecoverableFailure(
  response,
  sourceAccount,
  signers,
  builder,
  server,
) {
  let errCode = ((response.extras || {}).result_codes || {}).transaction;
  while (
    response.status === 504 ||
    (response.status === 400 && ["tx_bad_seq", "tx_too_late"].includes(errCode))
  ) {
    console.log(`A recoverable error occurred: ${response}`);
    if (errCode === "tx_bad_seq") {
      // Update sequence number.
      // This could happen when submitting transactions using the same account
      // across concurrent processes.
      builder.source = await server.loadAccount(sourceAccount.publicKey());
    }
    // reset timebounds
    builder.timebounds = null;
    const tx = builder.setTimeout(30).build();
    tx.sign(...signers);
    try {
      response = await server.submitTransaction(tx);
    } catch (e) {
      response = e.response.data;
    }
    errCode = ((response.extras || {}).result_codes || {}).transaction;
  }
  if (!response.successful)
    console.log(`Unable to recover from error: ${response}`);
  return response;
}
