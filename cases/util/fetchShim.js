import doFetch from "node-fetch";
export const fetch = (...args) => {
	return doFetch(...args);
};
