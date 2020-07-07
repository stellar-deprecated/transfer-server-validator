import { fetch } from "../../util/fetchShim";
import { waitForLoad, openObservableWindow } from "./browser-util";
import { getTransactionSchema } from "./schema";
import FormData from "form-data";

export async function createTransaction({
  currency,
  account,
  toml,
  jwt,
  isDeposit,
}) {
  const params = new FormData();
  if (currency) params.append("asset_code", currency);
  if (account) params.append("account", account);

  const headers = Object.assign(
    { Authorization: `Bearer ${jwt}` },
    params.getHeaders(),
  );

  const transferServer = toml.TRANSFER_SERVER_SEP0024 || toml.TRANSFER_SERVER;
  const transactionsUrl =
    transferServer +
    `/transactions/${isDeposit ? "deposit" : "withdraw"}/interactive`;
  const response = await fetch(transactionsUrl, {
    headers,
    method: "POST",
    body: params,
  });

  const status = response.status;
  const json = await response.json();

  return {
    status,
    json,
  };
}
