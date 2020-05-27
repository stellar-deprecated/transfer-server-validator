# transfer-server-validator

Test suite for validating services support for SEP24.

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

### Showing the browser for interactive tests

Normally everything runs headless, but if you want to watch as the test walks
through your interactive flow, set the `SHOW_BROWSER=1` environment variable
before running the command.

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
DOMAIN=https://testanchor.stellar.org MAINNET=1 MAINNET_MASTER_SECRET_KEY=S... npx jest --roots=cases-SEP24
```

Running the client+server

```
MAINNET_MASTER_SECRET_KEY=S... npm run start:dev
```

## Instructions for anchors

### Automatic Deposit Approval

Our automated testing assumes that deposits are automatically approved for
testnet deployments. This also makes it easier for manual testing so people can
complete the flow without any coordination with the anchors.

### Interactive flow instrumentation

The interactive flow of SEP24 is custom for each anchor which makes it difficult
to automate. In order to help the automated tests complete your interactive
flow, any form fields need to be annotated with expected values.

There are two things that need to be done: provide valid values for each field,
and identify which button should be pressed to continue.

#### Providing field values

Any form field that is required should have a `test-value` attribute which is
set to a valid value for that field. For example an email field would look like
`<input type='text' id='email_address' test-value='dummyaddress2342@gmail.com' />`.
The number can be randomized at render time to avoid reuse.

Make sure the `test-value` for the deposit's 'Amount' field is greater than the
`test-value` for the withdraw's 'Amount' field _plus_ the fee that will be
charged for the deposit transaction. If this isn't the case, submitting the
withdraw transaction to the stellar network will fail due to insufficient funds.

An example of doing this using Polaris's form stack can be seen
[here](https://github.com/stellar/django-polaris/blob/fd5900d68fec6b0e31ce720262e8d787fcbf8aac/example/server/forms.py#L10,L15)
but any framework should be able to add these attributes to the HTML of the
form.

#### Identifying Submit Button

The submit button should be annotated with `test-action="submit"`. This tells
the test-bot which button should be pressed to continue on in the flow.

Polaris does this automatically for anyone using the Forms stack
[here](https://github.com/stellar/django-polaris/blob/fd5900d68fec6b0e31ce720262e8d787fcbf8aac/polaris/polaris/templates/withdraw/form.html#L38)

#### Example of fully annotated form

```
<form action="/submit">
  <input type="text" id="full-name" test-value="Albert Einstein">
  <input type="text" id="email" test-value="325235@gmail.com" />
  <input type="submit" test-action="submit" value="Continue">
</form>
```

With these steps completed, the validation tooling should be able to exercise
the entirety of your implementation.
