const express = require("express");
const equal = require('deep-equal');
const concat = require('concat-stream');

const app = express();
app.use(express.json({ limit: '100mb', strict: false })).use(function(req, res, next) {
    req.pipe(concat(function(data) {
        req.rawBody = data.toString();
        next();
    }));
});

let expectationsBySession = {};
let errorsBySession = {};

function addError(sessionId, message, response) {
    if (!errorsBySession.hasOwnProperty(sessionId)) {
        errorsBySession[sessionId] = [];
    }

    errorsBySession[sessionId].push(message);

    response.status(501).json({ message }).send();
}

app.post('/session', function (request, response) {
    const { id, previousId } = request.body;
    if (!id) {
        response.status(400).json({ message: 'Missing session id' });
        return;
    }

    if (!id.match(/^[a-z0-9]{64}$/)) {
        response.status(400).json({ message: 'Invalid session id (should be 64 hex chars)'})
        return;
    }

    if (previousId) {
        delete expectationsBySession[previousId];
        delete errorsBySession[previousId];
    }

    expectationsBySession[id] = [];
    response.status(200).json({});
});

app.put('/expectation', function (request, response) {
    const { sessionId } = request.body;
    if (!sessionId) {
        response.status(400).json({ message: 'Session id must be set' });
        return;
    }

    if (!expectationsBySession.hasOwnProperty(sessionId)) {
        response.status(400).json({ message: 'Undefined session' });
        return;
    }

    const { path, method, body, response: expectedResponse, optionalFields, raw } = request.body;
    if (!path || !method || !body || !expectedResponse) {
        response.status(400).json({ message: 'Missing required fields' }).send();
        return;
    }

    expectationsBySession[sessionId].push({
        path,
        method,
        body,
        response: expectedResponse,
        optionalFields,
        raw
    });

    response.send();
});

app.get('/errors', function (request, response) {
    const sessionId = request.query.sessionId;
    if (!sessionId) {
        response.status(400).json({ message: 'Missing session id in request' });
        return;
    }

    const targetErrors = [...(errorsBySession[sessionId] || [])];
    const sessionExpectations = expectationsBySession[sessionId] || [];

    if (sessionExpectations.length > 0 && targetErrors.length === 0) {
        targetErrors.push(`Expectation list is not empty: ${sessionExpectations.map((e) => `${e.path} with ${JSON.stringify(e.body, undefined, 2)}`)}`);
    }

    response.json({ errors: targetErrors }).send();
});

app.delete('/flush', function (request, response) {
    errorsBySession = {};
    expectationsBySession = {};

    response.status(205).send();
});

app.all(/^\/[a-z0-9]{64}(\/*)?/, function (request, response) {
    const sessionId = request.originalUrl.substring(1, 65);
    if (!expectationsBySession.hasOwnProperty(sessionId)) {
        addError(sessionId, 'Session is not created', response);
        return;
    }

    const originalUrl = request.originalUrl.substr(65);

    const requestPath = ((originalUrl === '') || (originalUrl === '/'))
        ? '/'
        : originalUrl.replace(/\/$/, '');

    const method = request.method;
    const body = request.body;

    const expectation = expectationsBySession[sessionId].shift();
    if (!expectation) {
        return addError(sessionId, `There were no expectations for request ${requestPath} with ${JSON.stringify(body, undefined, 2)}`, response);
    }

    if (expectation.raw) {
        let requestBody = request.rawBody || request.body;
        if (expectation.body !== requestBody) {
            return addError(sessionId, `Expected raw body ${expectation.body} does not match actual ${requestBody}`, response);
        }

        response
            .status(expectation.response.code || 200)
            .json(expectation.response.body || {})
            .send();

        return;
    }

    if (Array.isArray(expectation.optionalFields)) {
        expectation.optionalFields.forEach((accessor) => {
            if (!accessor.startsWith('[') && !accessor.startsWith('.')) {
                accessor = `.${accessor}`;
            }

            try {
                eval(`body${accessor} = "*"`);
                eval(`expectation.body${accessor} = "*"`);
            } catch (e) {
                console.log(e);
            }
        })
    }

    if (method !== expectation.method) {
        return addError(sessionId, `Expected method ${expectation.method} does not match actual ${method}`, response);
    }

    if (!expectation.path.startsWith('/')) {
        expectation.path = `/${expectation.path}`;
    }

    if (requestPath !== expectation.path) {
        return addError(sessionId, `Expected path ${expectation.path} does not match actual ${requestPath} ${JSON.stringify(body, undefined, 2)}`, response);
    }

    if (!equal(body, expectation.body)
        && !(
            ['[]', '{}'].includes(JSON.stringify(body))
            && ['[]', '{}'].includes(JSON.stringify(expectation.body))
        )
    ) {
        return addError(
            sessionId,
            `Expected request body ${JSON.stringify(expectation.body, undefined, 2)} does not match actual ${JSON.stringify(body, undefined, 2)}`,
            response
        );
    }

    response
        .status(expectation.response.code || 200)
        .json(expectation.response.body || {})
        .send()
    ;
});

app.listen(process.env.PORT || 80);
