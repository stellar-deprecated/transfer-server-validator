export const values = {
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
  accountID: "bd1f4495-bc99-4d20-8bd3-6bc3f812ee1f",

  routing_number: "1234567890",
  account_number: "9876543210",
};

export const altValues = {
  family_name: "Ross",
  last_name: "Ross",
  given_name: "Bob",
  first_name: "Bob",
  additional_name: "Bob",
  address_country_code: "CA",
  state_or_province: "BC",
  city: "Vancouver",
  postal_code: "V5R 5L8",
  address: "3527 Kingsway, Vancouver, BC V5R 5L8, Canada",
  mobile_number: "+14155552672",
  email_address: "bobrossstellar2@gmail.com",
  birth_date: "1976-07-05",
  birth_place: "Vancouver",
  birth_country_code: "CA",
  bank_account_number: "1234567891",
  bank_number: "102101641",
  bank_phone_number: "+14155552671",
  tax_id: "123-45-6781",
  tax_id_name: "SSN",
  occupation: "artist",
  employer_name: "self-employed",
  employer_address: "3527 Kingsway, Vancouver, BC V5R 5L8, Canada",
  language_code: "en",
  id_type: "drivers_license",
  id_country_code: "CA",
  id_issue_date: "2019-20-21",
  id_expiration_date: "2021-20-21",
  id_number: "A1234568",
  photo_id_front: "TODO: NEEDS BINARY",
  photo_id_back: "TODO: NEEDS BINARY",
  notary_approval_of_photo_id: "TODO: NEEDS BINARY",
  ip_address: "58.15.221.204",
  photo_proof_residence: "TODO: NEEDS BINARY",

  customerFinClusiveID: "140609202",
  clientFinClusiveID: "140609203",
  accountID: "bd1f4495-bc99-4d20-8bd3-6bc3f812ee1f",

  routing_number: "1234567891",
  account_number: "9876543211",
};

function convertSection(section) {
  return Object.fromEntries(
    Object.keys(section).map((key) => [key, values[key]]),
  );
}

export function convertSEP31Fields(fieldDef) {
  return {
    transaction: convertSection(fieldDef.transaction),
  };
}
