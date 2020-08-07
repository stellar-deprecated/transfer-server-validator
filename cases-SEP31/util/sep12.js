import { loggableFetch } from "../../util/loggableFetcher";
import { values } from "./sep9-fields";
import FormData from "form-data";

export async function getPutRequestBodyObj(
  account,
  memo,
  memo_type,
  kycURL,
  jwt,
  fieldsRequired = {},
) {
  let headers = {
    Authorization: `Bearer ${jwt}`,
  };
  if (Object.keys(fieldsRequired).length == 0) {
    let encodedMemo = encodeURIComponent(memo);
    let uri =
      kycURL +
      `/customer?account=${account}&memo=${encodedMemo}&memo_type=${memo_type}`;
    let { json, logs, status } = await loggableFetch(uri, { headers: headers });
    fieldsRequired = json.fields;
  }
  let fieldKeys = Object.keys(fieldsRequired);
  let customerValues = {
    account: account,
    memo: memo,
    memo_type: memo_type,
  };
  for (let key of fieldKeys) {
    if (!values[key]) {
      console.log(`The validator doesn't have a ${key} SEP-9 field`);
      continue;
    }
    customerValues[key] = values[key];
  }
  return { customerValues: customerValues, fieldsRequired: fieldsRequired };
}

export async function createCustomer(account, memo, memo_type, kycURL, jwt) {
  let headers = {
    Authorization: `Bearer ${jwt}`,
  };
  let { customerValues, fieldsRequired } = await getPutRequestBodyObj(
    account,
    memo,
    memo_type,
    kycURL,
    jwt,
  );
  const formData = new FormData();
  formData.append("account", customerValues["account"]);
  formData.append("memo", customerValues["memo"]);
  formData.append("memo_type", customerValues["memo_type"]);
  for (let key in customerValues) {
    if (["account", "memo", "memo_type"].includes(key)) continue;
    formData.append(key, values[key]);
  }
  let { json, logs, status } = await loggableFetch(kycURL + "/customer", {
    headers: headers,
    method: "PUT",
    body: formData,
  });
  expect(status).toEqual(202);
  expect(json.id).toEqual(expect.any(String));
  return { customer_id: json.id, fieldsRequired: fieldsRequired };
}
