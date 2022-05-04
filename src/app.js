const Express = require("express");
const concat = require('concat-stream');

const State = require("./State");
const Endpoints = require("./Endpoints");

// Initialization
State.instance;

const app = Express();

app.use(Express.json({ limit: '100mb', strict: false }));
app.use(function(req, res, next) {
    req.pipe(concat(function(data) {
        req.rawBody = data.toString();
        next();
    }));
});

app.post('/session', Endpoints.createSession);
app.get('/errors', Endpoints.getErrors);
app.delete('/flush', Endpoints.flush);

app.post("/grpc/enable", Endpoints.enableGrpcForSession);
app.put("/expectation/grpc", Endpoints.addExpectation("grpc"));
app.put('/expectation', Endpoints.addExpectation("http"));
app.all(/^\/[a-z0-9]{64}(\/*)?/, Endpoints.matchHttpRequest);

module.exports = app;
