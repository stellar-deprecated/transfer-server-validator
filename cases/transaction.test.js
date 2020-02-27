import { fetch } from "./util/fetchShim";
import getSep10Token from "./util/sep10";
import getTomlFile from "./util/getTomlFile";
import StellarSDK from "stellar-sdk";
import { createTransaction } from "./util/transactions";
import {
    errorSchema,
    getTransactionSchema
} from "./util/schema";

jest.setTimeout(60000);

const urlBuilder = new URL(process.env.DOMAIN);
const domain = urlBuilder.toString();
const secret = "SAUOSXXF7ZDO5PKHRFR445DRKZ66Q5HIM2HIPQGWBTUKJZQAOP3VGH3L";
const keyPair = StellarSDK.Keypair.fromSecret(secret);

describe("Transaction", () => {
    let toml;
    let enabledCurrency;
    let jwt;

    beforeAll(async () => {
        toml = await getTomlFile(domain);
        jwt = await getSep10Token(domain, keyPair);
        
        const infoResponse = await fetch(toml.TRANSFER_SERVER + "/info", {
            headers: {
                Origin: "https://www.website.com"
            }
        });
        const infoJSON = await infoResponse.json();
        const currencies = Object.keys(infoJSON.deposit);

        enabledCurrency = currencies.find(
            currency => infoJSON.deposit[currency].enabled
        );
        
        expect(enabledCurrency).toBeDefined();
        expect(toml.TRANSFER_SERVER).toBeDefined();
    });

    async function getTransactionBy({ value, iden = "id", expectStatus = 200} = {}) {
        const response = await fetch(
            toml.TRANSFER_SERVER + `/transaction?${iden}=${value}`, {
            headers: {
                Authorization: `Bearer ${jwt}`
            }
        });
        expect(response.status).toEqual(expectStatus);
        return await response.json();
    };

    async function checkTransactionResponse({ json, isDeposit }) {
        expect(json.error).not.toBeDefined();
        const schema = getTransactionSchema(isDeposit);
        expect(json).toMatchSchema(schema);
    };

    it("has CORS on the transaction endpoint", async () => {
        const response = await fetch(toml.TRANSFER_SERVER + "/transaction", {
            headers: {
                Origin: "https://www.website.com"
            }
        });
        expect(response.headers.get("access-control-allow-origin")).toBe("*");
    });

    it("has the correct object schema for an existing deposit transaction", async () => {
        let { json } = await createTransaction({
            currency: enabledCurrency,
            account: keyPair.publicKey(),
            toml: toml,
            jwt: jwt,
            isDeposit: true
        });
        json = await getTransactionBy({ value: json.id });
        await checkTransactionResponse({ json: json, isDeposit: true })
    });

    it("has the correct object schema for an existing withdrawal transaction", async () => {
        let { json } = await createTransaction({
            currency: enabledCurrency,
            account: keyPair.publicKey(),
            toml: toml,
            jwt: jwt,
            isDeposit: false
        });
        
        json = await getTransactionBy({ value: json.id});
        await checkTransactionResponse({ json: json, isDeposit: false});
    });

    it.skip("json retreived by stellar_transaction_id returns correct object schema", async () => {
        // Can't this test wouldn't succeed because stellar_transaction_id would be populated
        // after the anchor submited the deposit to the stellar network. This test will have
        // to wait until we have the code to walk through the interactive flow working.

        // do interactive flow, then:

        let json = await getTransactionBy({ 
            iden: "stellar_transaction_id", 
            value: json.stellar_transaction_id 
        });
        await checkTransactionResponse({ json: json, isDeposit: true });
    });

    it("return a proper available more_info_url transaction link", async () => {
        let { json } = await createTransaction({
            currency: enabledCurrency,
            account: keyPair.publicKey(),
            toml: toml,
            jwt: jwt,
            isDeposit: true
        });

        json = await getTransactionBy({ value: json.id })
        console.log(json);
        const moreInfo = await fetch(json.transaction.more_info_url);
        expect(moreInfo.status).toEqual(200);
    });

    it("returns a proper error with missing params", async () => {
        const response = await fetch(
            toml.TRANSFER_SERVER + "/transaction", {
            headers: {
                Authorization: `Bearer ${jwt}`
            }
        });

        const json = await response.json();
        expect(response.status).not.toEqual(200);
        expect(json).toMatchSchema(errorSchema);
    });

    it("returns a proper error for a non-existing transaction by id", async () => {
        const json = await getTransactionBy({ 
            value: "1277bd18-a2bd-4acd-9a87-2f541c7b8933",
            expectStatus: 404
        });
        expect(json).toMatchSchema(errorSchema);
    });

    it("returns a proper error for a non-existing transaction by stellar_transaction_id", async () => {
        const json = await getTransactionBy({
            iden: "stellar_transaction_id",
            value: "17a670bc424ff5ce3b386dbfaae9990b66a2a37b4fbe51547e8794962a3f9e6a",
            expectStatus: 404
        });
        expect(json).toMatchSchema(errorSchema);
    });

    it("returns a proper error for a non-existing transaction by external_transaction_id", async () => {
        const json = await getTransactionBy({
            iden: "external_transaction_id",
            value: "2dd16cb409513026fbe7defc0c6f826c2d2c65c3da993f747d09bf7dafd31093",
            expectStatus: 404
        });
        expect(json).toMatchSchema(errorSchema);
    });
});
