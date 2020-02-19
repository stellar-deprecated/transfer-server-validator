import { fetch } from "./fetchShim";
import FormData from "form-data";

export async function createTransaction(asset_code, account, toml, jwt, authenticate, isDeposit) {
    const params = new FormData();
    if (asset_code) params.append("asset_code", asset_code);
    if (account) params.append("account", account);
    const authenticatedHeaders = Object.assign(
        { Authorization: `Bearer ${jwt}`},
        params.getHeaders()
    );

    const transactionsUrl = toml.TRANSFER_SERVER + `/transactions/${isDeposit ? 'deposit' : 'withdraw'}/interactive`;
    const response = await fetch(
        transactionsUrl, {
            headers: authenticate ? authenticatedHeaders : params.getHeaders(),
            method: "POST",
            body: params
        }
    );

    const status = response.status;
    const json = await response.json();

    return {
        status,
        json
    };
};