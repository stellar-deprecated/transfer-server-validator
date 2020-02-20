# transfer-server-validator

Test suite for validating services support for SEP24.

## Running

### Via CLI

```
$ yarn
$ DOMAIN=https://stellar-anchor-server.herokuapp.com npx jest
```

### Running a specific test

```
DOMAIN=https://localhost:8000 npx jest -I -i cases/deposit.test.js
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

### Running Optional Tests

Normall optional tests do not run. You can include them in your test run in docker like so:
```
docker run -e RUN_OPTIONAL_TESTS=1 -e DOMAIN=http://<yourdomain.com transfer-server-validator
```

And if you're running `jest` directly, you can use the `--testPathIgnorePatterns` flag:
```
DOMAIN=https://stellar-anchor-server.herokuapp.com npx jest --testPathIgnorePatterns='\b(\w*optional\w*)\b'
```

The UI provides an option to run these optional tests as well.

### Running Locally

```
# Run the server+client
$ npm install
$ npm run start:dev

```

### Automated monitoring

TBD
