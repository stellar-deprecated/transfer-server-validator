import { loggableFetch } from "../../util/loggableFetcher";
import { values } from "./sep9-fields";

async function createCustomer(
  account,
  memo,
  memo_type,
  url,
  jwt,
  fields_needed,
) {
  headers = {
    Authorization: `Bearer ${jwt}`,
  };
  formData = new FormData();
  for (let key of fields_needed) {
    if (!values[key]) {
      console.log(`The validator doesn't have a ${key} SEP-9 field`);
      continue;
    }
    formData.append(key, values[key]);
  }
  let response = await loggableFetch(url, {
    headers: headers,
    method: "PUT",
    body: formData,
  });
  expect(response.status).toEqual(202);
  let json = await response.json();
  expect(json.id).toEqual(expect.any(String));
  return json.id;
}
