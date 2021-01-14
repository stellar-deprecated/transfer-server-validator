const StellarSDK = require("stellar-sdk");

let horizon = new StellarSDK.Server(
  "https://horizon-testnet.stellar.org",
  "Test SDF Network ; September 2015",
);
horizon
  .loadAccount("GCSRGBUUXZTNAD7Q4HRCAV3NNBSRJE4EZTLRSDH2VHJXGPQTVHI2CI4Q")
  .then((account) => {
    let builder = new StellarSDK.TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: "Test SDF Network ; September 2015",
    });
    let tx = builder
      .addOperation(StellarSDK.Operation.bumpSequence({ bumpTo: "101" }))
      .setTimeout(30)
      .build();
    tx.sign(
      StellarSDK.Keypair.fromSecret(
        "SDCB6BTONHZ4AFQZNZ4PAQ3BLDJNZ4KG2MUQOWUCHS52ZGRVVBMAUWUR",
      ),
    );
    horizon
      .submitTransaction(tx)
      .then((resp) => console.log(resp))
      .catch((err) => console.log(err.response.data));
  })
  .catch((err) => console.log(err));
