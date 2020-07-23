import StellarSdk from "stellar-sdk";

// This is the keypair used by our tests. Anchors should add this as a valid SEP-31 counterparty
// to ensure the tests can run successfully.
export const publicKey =
  "GA5O75ANOQPDBEQER2ALOAC65Y5K2PDDVOJ2NCKILVBAXIXON7TY2GC5";
export const keyPair = StellarSdk.Keypair.fromSecret(
  "SCOZ76NRBGAYZONAPYSO6V5P2PQKWORXRPDUL4A7BGC3ZRF6HBZFOFVG",
);
