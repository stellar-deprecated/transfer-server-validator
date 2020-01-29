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

### Using a self-signed certificate

If you're developing locally and need to use a self-signed certificate, pass the env var `NODE_TLS_REJECT_UNAUTHORIZED="0"` in order to avoid the `request to https://localhost:8000/.well-known/stellar.toml failed, reason: self signed certificate` error.

### Testing an http 

### Via Docker

```
$ docker build -t transfer-server-validator .
$ docker run  -p 3000:3000  transfer-server-validator

### Running locally

```
# Run the server
$ yarn
$ yarn start

# Run the client
$ cd client
$ yarn
$ yarn start
```

### Automated monitoring

TBD
