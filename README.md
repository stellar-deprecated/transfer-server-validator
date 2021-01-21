# transfer-server-validator

Test suite for validating SEP-6, SEP-24, & SEP-31 transfer servers.

## Running

### Via CLI

```
$ yarn
$ DOMAIN=https://testanchor.stellar.org npx jest
```

### Testing a specific currency

```
$ DOMAIN=https://testanchor.stellar.org  CURRENCY=SRT npx jest -I -i cases/deposit.test.js
```

### Running a specific test

```
$ DOMAIN=https://localhost:8000 npx jest -I -i cases-SEP24/deposit.test.js

```

### Using a self-signed certificate

If you're developing locally and need to use a self-signed certificate, pass the
env var `NODE_TLS_REJECT_UNAUTHORIZED="0"` in order to avoid the
`request to https://localhost:8000/.well-known/stellar.toml failed, reason: self signed certificate`
error.

### Via Docker

```
$ docker build -t transfer-server-validator .
$ docker run  -p 3000:3000  transfer-server-validator
# to run in the CLI
$ docker run -e DOMAIN=http://<yourdomain.com transfer-server-validator
```

## Run a specified project via Docker

```
$ docker build -t transfer-server-validator .
$ docker run -p 3000:3000 -e PROJECT=SEP31 transfer-server-validator
```

### Running Optional Tests

Normally optional tests do not run. You can include them in your test run in
docker like so:

```
$ docker run -e RUN_OPTIONAL_TESTS=1 -e DOMAIN=http://<yourdomain.com transfer-server-validator
```

And if you're running `jest` directly, you can use the
`--testPathIgnorePatterns` flag:

```
DOMAIN=https://testanchor.stellar.org npx jest --testPathIgnorePatterns='\b(\w*optional\w*)\b'
```

The UI provides an option to run these optional tests as well.

### Running the Server Locally

```
# Run the server+client
$ npm install
$ npm run start:dev

```

### Run a specified project Locally

```
# Run the server+client
$ npm install
$ PROJECT=SEP24 npm run start:dev

# Or run from the command line
$ DOMAIN=https://testanchor.stellar.org npx jest --roots=cases-SEP6
```

## Running test suite for mainnet anchors

When using https://anchor-validator.stellar.org, running the validation suite on
mainnet is as easy as selecting the 'Run on mainnet' checkbox.

When running your own instance of this project, you have to specify the
following environment variables

`MAINNET=1` This lets the project know it should expect the anchor to use
mainnet

`MAINNET_MASTER_SECRET_KEY` This is a stellar account secret key that is used to
create temporary accounts for tests. This 'master' account must have at least 50
XLM in order to fund these accounts. When tests finish, the temporary accounts
will be merged back to the master account.

Running from the command line should look like this (testanchor.stellar.org does
not run on mainnet)

```
$ DOMAIN=https://testanchor.stellar.org MAINNET=1 MAINNET_MASTER_SECRET_KEY=S... npx jest --roots=cases-SEP24
```

Running the client+server

```
$ MAINNET_MASTER_SECRET_KEY=S... npm run start:dev
```

## Instructions for anchors

### Automatic Deposit Approval

Our automated testing assumes that deposits are automatically approved for
testnet deployments. This also makes it easier for manual testing so people can
complete the flow without any coordination with the anchors.

### Interactive flow testing

The transfer server validator does not test SEP-24 interactive flows, since they
are custom for each anchor.
