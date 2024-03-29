const Mismatch = require("../Mismatch");
const equal = require("deep-equal");

const BODY_TYPE_JSON = 'json';
const BODY_TYPE_PLAIN = 'plain';
const BODY_TYPE_BINARY = 'binary';

module.exports = class Expectation {
    path;
    method;
    body;
    response;
    optionalFields;
    bodyType;

    static fromRequest(request) {
        const { path, method, body, response, optionalFields, bodyType = BODY_TYPE_JSON } = request.body;
        if (!path || !method || !body || !response || !bodyType) {
            throw new Error("Missing required fields");
        }

        if (![BODY_TYPE_JSON, BODY_TYPE_PLAIN, BODY_TYPE_BINARY].includes(bodyType)) {
            throw new Error("Invalid body type");
        }

        return new Expectation(path, method, body, response, optionalFields, bodyType);
    }

    constructor(path, method, body, response, optionalFields, bodyType) {
        this.path = path;
        this.method = method;
        this.body = body;
        this.response = response;
        this.optionalFields = optionalFields;
        this.bodyType = bodyType;
    }

    match = (request) => {
        const requestPath = request.originalUrl.substr(65).replace(/\/$/, '') || '/';
        const method = request.method;
        const body = request.body;

        // Resetting optional fields
        if (Array.isArray(this.optionalFields)) {
            this.optionalFields.forEach((accessor) => {
                if (!accessor.startsWith('[') && !accessor.startsWith('.')) {
                    accessor = `.${accessor}`;
                }

                try {
                    eval(`body${accessor} = "*"`);
                    eval(`this.body${accessor} = "*"`);
                } catch (e) {
                }
            })
        }

        if (method !== this.method) {
            throw new Mismatch(`Expected method ${this.method} does not match actual ${method}`);
        }

        if (!this.path.startsWith('/')) {
            this.path = `/${this.path}`;
        }

        if (requestPath !== this.path) {
            const actualBodyString = JSON.stringify(body, undefined, 2);
            throw new Mismatch(`Expected path ${this.path} does not match actual ${requestPath} ${actualBodyString}`);
        }

        if (this.bodyType !== BODY_TYPE_JSON) {
            const requestBody = this.bodyType === BODY_TYPE_PLAIN
                ? request.rawBody.toString('utf-8')
                : request.rawBody.toString('hex');

            if (this.body !== requestBody) {
                throw new Mismatch(`Expected raw body ${this.body} does not match actual ${requestBody}`);
            }

            return this.matchedResponse;
        }

        const bodiesEqual = equal(body, this.body) || (
            ['[]', '{}'].includes(JSON.stringify(body))
            && ['[]', '{}'].includes(JSON.stringify(this.body))
        );

        if (bodiesEqual) {
            return this.matchedResponse;
        }

        const expectedBodyString = JSON.stringify(this.body, undefined, 2);
        const actualBodyString = JSON.stringify(body, undefined, 2);
        const message = `Expected request body ${expectedBodyString} does not match actual ${actualBodyString}`;

        throw new Mismatch(message);
    }

    get matchedResponse() {
        return {
            body: this.response.body,
            code: this.response.code || 200,
        };
    }
};
