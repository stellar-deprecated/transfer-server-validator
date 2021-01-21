import { fetch } from "../../util/fetchShim";
import { getTransactionSchema } from "./schema";
import FormData from "form-data";

// Data required in GET /deposit or /withdraw request for each anchor
const anchorRequestData = {
  testanchor: {
    deposit: {
      type: "bank_account",
    },
    withdraw: {
      type: "bank_account",
      dest: "fake bank number",
      dest_extra: "fake bank routing number",
    },
    kyc: {
      first_name: "First",
      last_name: "Last",
      email_address: "email@email.com",
      bank_number: "fake bank routing number",
      bank_account_number: "fake bank number",
    },
  },
};

export async function putKYCInfo({ toml, account, jwt }) {
  const params = new FormData();
  params.append("account", account);
  let anchorReqData = getRequestData(toml.KYC_SERVER, "kyc");
  for (let key in anchorReqData) {
    params.append(key, anchorReqData[key]);
  }

  const response = await fetch(toml.KYC_SERVER + "/customer", {
    headers: { Authorization: `Bearer ${jwt}` },
    method: "PUT",
    body: params,
  });

  const status = response.status;
  expect(status).toEqual(202);
  const json = await response.json();

  return {
    status,
    json,
  };
}

export async function createTransaction({
  currency,
  account,
  toml,
  jwt,
  isDeposit,
}) {
  const headers = { Authorization: `Bearer ${jwt}` };

  let params = new URLSearchParams();
  if (currency) params.append("asset_code", currency);
  if (account) params.append("account", account);

  let anchorReqData = getRequestData(
    toml.TRANSFER_SERVER,
    isDeposit ? "deposit" : "withdraw",
  );
  for (let [key, value] of Object.entries(anchorReqData)) {
    params.append(key, value);
  }

  const transactionsUrl =
    toml.TRANSFER_SERVER + `/${isDeposit ? "deposit" : "withdraw"}`;
  const response = await fetch(transactionsUrl + "?" + params.toString(), {
    headers,
  });

  const status = response.status;
  const json = await response.json();

  return {
    status,
    json,
  };
}

function getRequestData(transferServer, key) {
  for (let anchor in anchorRequestData) {
    if (transferServer.includes(anchor)) {
      let anchorData = anchorRequestData[anchor];
      return anchorData[key];
    }
  }
}
