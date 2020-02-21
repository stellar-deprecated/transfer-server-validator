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

        const response = await fetch(
            toml.TRANSFER_SERVER + "/transaction?id=" + json.id, {
            headers: {
                Authorization: `Bearer ${jwt}`
            }
        });
        json = await response.json();

        expect(response.status).toEqual(200);
        expect(json.error).not.toBeDefined();

        const schema = getTransactionSchema(true);
        expect(json).toMatchSchema(schema);
    });

    it("has the correct object schema for an existing withdrawal transaction", async () => {
        let { json } = await createTransaction({
            currency: enabledCurrency,
            account: keyPair.publicKey(),
            toml: toml,
            jwt: jwt,
            isDeposit: false
        });

        const response = await fetch(
            toml.TRANSFER_SERVER + "/transaction?id=" + json.id, {
            headers: {
                Authorization: `Bearer ${jwt}`
            }
        });
        json = await response.json();

        expect(response.status).toEqual(200);
        expect(json.error).not.toBeDefined();

        const schema = getTransactionSchema(false);
        expect(json).toMatchSchema(schema);
    });

    it("return a proper available more_info_url transaction link", async () => {
        let { json } = await createTransaction({
            currency: enabledCurrency,
            account: keyPair.publicKey(),
            toml: toml,
            jwt: jwt,
            isDeposit: true
        });

        const transaction = await fetch(
            toml.TRANSFER_SERVER + "/transaction?id=" + json.id, {
            headers: {
                Authorization: `Bearer ${jwt}`
            }
        });

        json = await transaction.json();
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
        const response = await fetch(
            toml.TRANSFER_SERVER +
            "/transaction?id=1277bd18-a2bd-4acd-9a87-2f541c7b8933", {
            headers: {
                Authorization: `Bearer ${jwt}`
            }
        });

        const json = await response.json();
        expect(response.status).toEqual(404);
        expect(json).toMatchSchema(errorSchema);
    });

    it("returns a proper error for a non-existing transaction by stellar_transaction_id", async () => {
        const response = await fetch(
            toml.TRANSFER_SERVER +
            "/transaction?stellar_transaction_id=17a670bc424ff5ce3b386dbfaae9990b66a2a37b4fbe51547e8794962a3f9e6a", {
            headers: {
                Authorization: `Bearer ${jwt}`
            }
        });

        const json = await response.json();
        expect(response.status).toEqual(404);
        expect(json).toMatchSchema(errorSchema);
    });

    it("returns a proper error for a non-existing transaction by external_transaction_id", async () => {
        const response = await fetch(
            toml.TRANSFER_SERVER +
            "/transaction?external_transaction_id=2dd16cb409513026fbe7defc0c6f826c2d2c65c3da993f747d09bf7dafd31093", {
            headers: {
                Authorization: `Bearer ${jwt}`
            }
        });

        const json = await response.json();
        expect(response.status).toEqual(404);
        expect(json).toMatchSchema(errorSchema);
    });
});
