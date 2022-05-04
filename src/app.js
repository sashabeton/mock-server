const Express = require("express");
const concat = require('concat-stream');

const State = require("./State");
const Endpoints = require("./Endpoints");

const state = new State();
const app = Express();

app.use(Express.json({ limit: '100mb', strict: false }));
app.use(function(req, res, next) {
    req.pipe(concat(function(data) {
        req.rawBody = data.toString();
        next();
    }));
});

app.post('/session', Endpoints.createSession(state));
app.get('/errors', Endpoints.getErrors(state));
app.delete('/flush', Endpoints.flush(state));

app.put('/expectation', Endpoints.addHttpExpectation(state));
app.all(/^\/[a-z0-9]{64}(\/*)?/, Endpoints.matchHttpRequest(state));

// todo: grpc expectation
// Todo: grpc matching

module.exports = app;
