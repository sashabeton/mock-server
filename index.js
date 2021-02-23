const express = require("express");
const equal = require('deep-equal');

const app = express();
app.use(express.json({ limit: '100mb' }));

let expectations = [];
let errors = [];

function addError(message, response) {
    errors.push(message);

    response.status(501).json({ message }).send();
}

app.put('/expectation', function (request, response) {
    const { path, method, body, response: expectedResponse, optionalFields } = request.body;
    if (!path || !method || !body || !expectedResponse) {
        response.status(400).json({ message: 'Missing required fields' }).send();

        return;
    }

    expectations.push({
        path,
        method,
        body,
        response: expectedResponse,
        optionalFields
    });

    response.send();
});

app.get('/errors', function (request, response) {
    const targetErrors = [...errors];

    if (expectations.length > 0) {
        targetErrors.push(`Expectation list is not empty: ${expectations.map((e) => e.path)}`);
    }

    response.json({ errors: targetErrors }).send();
});

app.delete('/flush', function (request, response) {
    errors = [];
    expectations = [];

    response.status(205).send();
});

app.all('/space*', function (request, response) {
    const requestPath = request.originalUrl.replace(/^\/space\/?/, '/');
    const method = request.method;
    const body = request.body;

    const expectation = expectations.shift();
    if (!expectation) {
        return addError(`There were no expectations for request ${requestPath}`, response);
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
        return addError(`Expected path ${expectation.path} does not match actual ${requestPath} ${JSON.stringify(body)}`, response);
    }

    if (!equal(body, expectation.body)
        && !(
            ['[]', '{}'].includes(JSON.stringify(body))
            && ['[]', '{}'].includes(JSON.stringify(expectation.body))
        )
    ) {
        return addError(
            `Expected request body ${JSON.stringify(expectation.body)} does not match actual ${JSON.stringify(body)}`,
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
