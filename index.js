const express = require("express");
const equal = require('deep-equal');
const concat = require('concat-stream');

const configurator = express();
configurator.use(express.json({ limit: '100mb' }));

const matcher = express();
matcher.use(express.json({ limit: '100mb' })).use(function(req, res, next){
    req.pipe(concat(function(data){
        req.rawBody = data.toString();
        next();
    }));
});

let expectations = [];
let errors = [];

function addError(message, response) {
    errors.push(message);

    response.status(501).json({ message }).send();
}

configurator.put('/expectation', function (request, response) {
    const { path, method, body, response: expectedResponse, optionalFields, raw } = request.body;
    if (!path || !method || !body || !expectedResponse) {
        response.status(400).json({ message: 'Missing required fields' }).send();

        return;
    }

    expectations.push({
        path,
        method,
        body,
        response: expectedResponse,
        optionalFields,
        raw
    });

    response.send();
});

configurator.get('/errors', function (request, response) {
    const targetErrors = [...errors];

    if (expectations.length > 0 && targetErrors.length === 0) {
        targetErrors.push(`Expectation list is not empty: ${expectations.map((e) => `${e.path} with ${JSON.stringify(e.body, undefined, 2)}`)}`);
    }

    response.json({ errors: targetErrors }).send();
});

configurator.delete('/flush', function (request, response) {
    errors = [];
    expectations = [];

    response.status(205).send();
});

matcher.all('/*', function (request, response) {
    const requestPath = request.originalUrl === '/'
        ? '/'
        : request.originalUrl.replace(/\/$/, '');

    const method = request.method;
    const body = request.body;

    const expectation = expectations.shift();
    if (!expectation) {
        return addError(`There were no expectations for request ${requestPath} with ${JSON.stringify(body, undefined, 2)}`, response);
    }

    if (expectation.raw) {
        if (expectation.body !== request.rawBody) {
            return addError(`Expected raw body ${expectation.body} does not match actual ${request.rawBody}`, response);
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
        return addError(`Expected method ${expectation.method} does not match actual ${method}`, response);
    }

    if (!expectation.path.startsWith('/')) {
        expectation.path = `/${expectation.path}`;
    }

    if (requestPath !== expectation.path) {
        return addError(`Expected path ${expectation.path} does not match actual ${requestPath} ${JSON.stringify(body, undefined, 2)}`, response);
    }

    if (!equal(body, expectation.body)
        && !(
            ['[]', '{}'].includes(JSON.stringify(body))
            && ['[]', '{}'].includes(JSON.stringify(expectation.body))
        )
    ) {
        return addError(
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

configurator.listen(process.env.CONFIGURATOR_PORT || 81, () => {
    matcher.listen(process.env.MATCHER_PORT || 80);
});
