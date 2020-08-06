import { loggableFetch } from "../../util/loggableFetcher";
import { values } from "./sep9-fields";
import FormData from "form-data";

export async function createCustomer(account, memo, memo_type, kycURL, jwt) {
  let headers = {
    Authorization: `Bearer ${jwt}`,
  };
  let encodedMemo = encodeURIComponent(memo);
  let uri =
    kycURL +
    `/customer?account=${account}&memo=${encodedMemo}&memo_type=${memo_type}`;
  let { json, logs, status } = await loggableFetch(uri, { headers: headers });
  let fieldsNeeded = Object.keys(json.fields);
  const formData = new FormData();
  formData.append("account", account);
  formData.append("memo", memo);
  formData.append("memo_type", memo_type);
  for (let key of fieldsNeeded) {
    if (!values[key]) {
      console.log(`The validator doesn't have a ${key} SEP-9 field`);
      continue;
    }
    formData.append(key, values[key]);
  }
  ({ json, logs, status } = await loggableFetch(kycURL + "/customer", {
    headers: headers,
    method: "PUT",
    body: formData,
  }));
  expect(status).toEqual(202);
  expect(json.id).toEqual(expect.any(String));
  return json.id;
}
