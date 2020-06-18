const values = {
  family_name: "Einstein",
  last_name: "Einstein",
  given_name: "Albert",
  first_name: "Albert",
  additional_name: "Bob",
  address_country_code: "US",
  state_or_province: "CA",
  city: "San Francisco",
  postal_code: "94115",
  address: "123 Street Lane\nSan Francisco, CA 94115",
  mobile_number: "+14155552671",
  email_address: "alberteinsteinstellar@gmail.com",
  birth_date: "1976-07-04",
  birth_place: "San Francisco",
  birth_country_code: "US",
  bank_account_number: "1234567890",
  bank_number: "102101645",
  bank_phone_number: "+14155552672",
  tax_id: "123-45-6789",
  tax_id_name: "SSN",
  occupation: "2112",
  employer_name: "The News",
  employer_address: "1234 The Main Street\nSeattle, WA 94332",
  language_code: "en",
  id_type: "drivers_license",
  id_country_code: "USA",
  id_issue_date: "2019-20-20",
  id_expiration_date: "2021-20-20",
  id_number: "A1234567",
  photo_id_front: "TODO: NEEDS BINARY",
  photo_id_back: "TODO: NEEDS BINARY",
  notary_approval_of_photo_id: "TODO: NEEDS BINARY",
  ip_address: "58.15.221.204",
  photo_proof_residence: "TODO: NEEDS BINARY",

  customerFinClusiveID: "140609202",
  clientFinClusiveID: "140609203",
};

function convertSection(section) {
  return Object.fromEntries(
    Object.keys(section).map((key) => [key, values[key]]),
  );
}

export function convertSEP31Fields(fieldDef) {
  return {
    sender: convertSection(fieldDef.receiver),
    receiver: convertSection(fieldDef.sender),
    transaction: convertSection(fieldDef.transaction),
  };
}
