import { matchers } from "jest-json-schema";
expect.extend(matchers);
expect.extend({
  // If anything goes wrong with a test that requires an account that was auto generated
  // We write the account used in the message along side all the other accounts that were
  // generated during the current run
  // This extends the signers support test previous truthy and falsy expectation matchers
  orElseLogKeypairs(token, logs, accountsUsed, accountPool) {
    const pass = token && logs;
    let usedAccs = "⬇️ Accounts used ⬇️\n -----------------------------";
    accountsUsed.forEach((kp) => {
      usedAccs += `
          \nPublicKey: ${kp.publicKey()}
          \nSecretKey: ${kp.secret()}
          \n -----------------------------`;
    });
    let genAccs = "⬇️ Generated Accounts ⬇️\n -----------------------------";
    accountPool.forEach((acc) => {
      genAccs += `
          \nPublicKey: ${acc.kp.publicKey()}
          \nSecretKey: ${acc.kp.secret()}
          \n -----------------------------`;
    });
    if (pass) {
      return {
        message: () => ``,
        pass: true,
      };
    } else {
      return {
        message: () => `
        ${logs}\n
        ${usedAccs}\n
        ${genAccs}`,
        pass: false,
      };
    }
  },
});
