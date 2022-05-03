# Mock Server

This application can be useful in testing where you need to request outside services.
You can change services URL to mock server URL and validate your requests/responses are being made in correct order with correct data.

## Running

### Building manually

You can clone this repository and start mock server with next setup:

```bash
npm i
node src/index.js
```

This will run mock server on 80 port. To change port you can set environment variable PORT:

```bash
PORT=81 node src/index.js
```

### Running in Docker

You can use [image](https://hub.docker.com/r/sashabeton/mock-server) for running application in docker container

## Todo:

- Add API docs
- Extend expectation settings to make it more flexible
