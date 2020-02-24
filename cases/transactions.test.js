import { fetch } from "./util/fetchShim";
import getSep10Token from "./util/sep10";
import getTomlFile from "./util/getTomlFile";
import { createTransaction } from "./util/transactions";
import StellarSDK from "stellar-sdk";
import {
    errorSchema,
    transactionsSchema,
    getTransactionSchema
} from "./util/schema";

jest.setTimeout(60000);

const urlBuilder = new URL(process.env.DOMAIN);
const domain = urlBuilder.toString();
const secret = "SAUOSXXF7ZDO5PKHRFR445DRKZ66Q5HIM2HIPQGWBTUKJZQAOP3VGH3L";
const keyPair = StellarSDK.Keypair.fromSecret(secret);

describe("Transactions", () => {
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
        expect(toml.WEB_AUTH_ENDPOINT).toBeDefined();
    });

    it("has CORS on the transactions endpoint", async () => {
        const response = await fetch(toml.TRANSFER_SERVER + "/transactions", {
            headers: {
                Origin: "https://www.website.com"
            }
        });
        expect(response.headers.get("access-control-allow-origin")).toBe("*");
    });

    it("return proper formatted transactions list", async () => {
        await createTransaction({
            currency: enabledCurrency,
            account: keyPair.publicKey(),
            toml: toml,
            jwt: jwt,
            isDeposit: true
        });

        const response = await fetch(
            toml.TRANSFER_SERVER + `/transactions?asset_code=${enabledCurrency}`, {
                headers: {
                    Authorization: `Bearer ${jwt}`
                }
            }
        );

        const json = await response.json();
        expect(response.status).toEqual(200);
        expect(json.error).not.toBeDefined();
        expect(json).toMatchSchema(transactionsSchema);

        json.transactions.forEach((transaction) => {
            const isDeposit = transaction.kind === 'deposit';
            const schema = getTransactionSchema(isDeposit);
            expect(transaction).toMatchSchema(schema.properties.transaction);
        });
    });

    it("return proper amount of transactions with limit param", async () => {
        await createTransaction({
            currency: enabledCurrency,
            account: keyPair.publicKey(),
            toml: toml,
            jwt: jwt,
            isDeposit: true
        });
        await createTransaction({
            currency: enabledCurrency,
            account: keyPair.publicKey(),
            toml: toml,
            jwt: jwt,
            isDeposit: false
        });

        const response = await fetch(
            toml.TRANSFER_SERVER + `/transactions?asset_code=${enabledCurrency}&limit=1`, {
                headers: {
                    Authorization: `Bearer ${jwt}`
                }
            }
        );

        const json = await response.json();
        expect(response.status).toEqual(200);
        expect(json.error).not.toBeDefined();
        expect(json.transactions.length).toBe(1);
    });

    it("return proper transactions with no_older_than param", async () => {
        const currentDate = new Date();
        await createTransaction({
            currency: enabledCurrency,
            account: keyPair.publicKey(),
            toml: toml,
            jwt: jwt,
            isDeposit: true
        });
        await createTransaction({
            currency: enabledCurrency,
            account: keyPair.publicKey(),
            toml: toml,
            jwt: jwt,
            isDeposit: false
        });

        const response = await fetch(
            toml.TRANSFER_SERVER + `/transactions?asset_code=${enabledCurrency}&no_older_than=${currentDate.toISOString()}`, {
                headers: {
                    Authorization: `Bearer ${jwt}`
                }
            }
        );

        const json = await response.json();
        expect(response.status).toEqual(200);
        expect(json.error).not.toBeDefined();
        expect(json.transactions.length).toBeGreaterThanOrEqual(2);

        json.transactions.forEach((transaction) => {
            const transactionStartedTime = new Date(transaction.started_at).getTime();
            expect(transactionStartedTime).toBeGreaterThanOrEqual(currentDate.getTime());
        });
    });

    it("return only deposit transactions with kind=deposit param", async () => {
        await createTransaction({
            currency: enabledCurrency,
            account: keyPair.publicKey(),
            toml: toml,
            jwt: jwt,
            isDeposit: true
        });
        await createTransaction({
            currency: enabledCurrency,
            account: keyPair.publicKey(),
            toml: toml,
            jwt: jwt,
            isDeposit: false
        });

        const response = await fetch(
            toml.TRANSFER_SERVER + `/transactions?asset_code=${enabledCurrency}&kind=deposit`, {
                headers: {
                    Authorization: `Bearer ${jwt}`
                }
            }
        );

        const json = await response.json();
        expect(response.status).toEqual(200);
        expect(json.error).not.toBeDefined();
        expect(json.transactions.length).toBeGreaterThanOrEqual(1);

        json.transactions.forEach((transaction) => {
            expect(transaction.kind).toBe("deposit");
        });
    });

    it("return only withdrawal transactions with kind=withdrawal param", async () => {
        await createTransaction({
            currency: enabledCurrency,
            account: keyPair.publicKey(),
            toml: toml,
            jwt: jwt,
            isDeposit: true
        });
        await createTransaction({
            currency: enabledCurrency,
            account: keyPair.publicKey(),
            toml: toml,
            jwt: jwt,
            isDeposit: false
        });

        const response = await fetch(
            toml.TRANSFER_SERVER + `/transactions?asset_code=${enabledCurrency}&kind=withdrawal`, {
                headers: {
                    Authorization: `Bearer ${jwt}`
                }
            }
        );

        const json = await response.json();
        expect(response.status).toEqual(200);
        expect(json.error).not.toBeDefined();
        expect(json.transactions.length).toBeGreaterThanOrEqual(1);
        
        json.transactions.forEach((transaction) => {
            expect(transaction.kind).toBe("withdrawal");
        });
    });

    it("return proper transactions with paging_id param", async () => {
        let { json } = await createTransaction({
            currency: enabledCurrency,
            account: keyPair.publicKey(),
            toml: toml,
            jwt: jwt,
            isDeposit: true
        });
        const pagingId = json.id;

        const pagingTransaction = await fetch(
            toml.TRANSFER_SERVER + `/transaction?id=${pagingId}`, {
            headers: {
                Authorization: `Bearer ${jwt}`
            }
        });
        const pagingJson = await pagingTransaction.json();

        const transactionsResponse = await fetch(
            toml.TRANSFER_SERVER + `/transactions?asset_code=${enabledCurrency}&paging_id=${pagingId}`, {
            headers: {
                Authorization: `Bearer ${jwt}`
            }
        });

        const transactionsJson = await transactionsResponse.json();
        expect(transactionsResponse.status).toEqual(200);
        expect(transactionsJson.error).not.toBeDefined();

        transactionsJson.transactions.forEach((transaction) => {
            const transactionStartedTime = new Date(transaction.started_at).getTime();
            const pagingStartedTime = new Date(pagingJson.transaction.started_at).getTime();
            expect(transactionStartedTime).toBeLessThan(pagingStartedTime);
        });
    });

    it("return proper transactions with all param", async () => {
        const currentDate = new Date();
        await createTransaction({
            currency: enabledCurrency,
            account: keyPair.publicKey(),
            toml: toml,
            jwt: jwt,
            isDeposit: true
        });
        let { json } = await createTransaction({
            currency: enabledCurrency,
            account: keyPair.publicKey(),
            toml: toml,
            jwt: jwt,
            isDeposit: true
        });
        const pagingId = json.id;

        const pagingTransaction = await fetch(
            toml.TRANSFER_SERVER + `/transaction?id=${pagingId}`, {
            headers: {
                Authorization: `Bearer ${jwt}`
            }
        });
        const pagingJson = await pagingTransaction.json();

        const transactionsResponse = await fetch(
            `${toml.TRANSFER_SERVER}/transactions?asset_code=${enabledCurrency}&kind=deposit&limit=1&paging_id=${pagingId}&no_older_than=${currentDate.toISOString()}`, {
            headers: {
                Authorization: `Bearer ${jwt}`
            }
        });

        const transactionsJson = await transactionsResponse.json();
        expect(transactionsResponse.status).toEqual(200);
        expect(transactionsJson.error).not.toBeDefined();
        expect(transactionsJson.transactions.length).toBe(1);

        transactionsJson.transactions.forEach((transaction) => {
            const transactionStartedTime = new Date(transaction.started_at).getTime();
            const pagingStartedTime = new Date(pagingJson.transaction.started_at).getTime();
            expect(transaction.kind).toBe("deposit");
            expect(transactionStartedTime).toBeLessThan(pagingStartedTime);
            expect(transactionStartedTime).toBeGreaterThanOrEqual(currentDate.getTime());
        });
    });

    it("return proper error with missing params", async () => {
        const response = await fetch(
            toml.TRANSFER_SERVER + `/transactions`, {
                headers: {
                    Authorization: `Bearer ${jwt}`
                }
            }
        );

        const json = await response.json();
        expect(response.status).not.toEqual(200);
        expect(json).toMatchSchema(errorSchema);
    });

    it("return proper error for a non-supported currency", async () => {
        const response = await fetch(
            toml.TRANSFER_SERVER + `/transactions?asset_code=XYXCEZZYBD`, {
                headers: {
                    Authorization: `Bearer ${jwt}`
                }
            }
        );

        const json = await response.json();
        expect(response.status).not.toEqual(200);
        expect(json).toMatchSchema(errorSchema);
    });
});