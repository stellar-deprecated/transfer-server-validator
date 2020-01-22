# transfer-server-validator

Test suite for validating services support for SEP24.

## Running

### Via CLI

```
$ yarn
$ DOMAIN=https://stellar-anchor-server.herokuapp.com npx jest
```

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
