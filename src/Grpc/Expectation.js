const Mismatch = require("../Mismatch");

module.exports = class Expectation {
    path;
    request;
    response;

    static fromRequest(request) {
        const { path, request: grpcRequest, response } = request.body;
        if ("string" !== typeof path) {
            throw new Error("Missing expected gRPC path");
        }

        if ("string" !== typeof grpcRequest) {
            throw new Error("Missing expected gRPC request");
        }

        if ("string" !== typeof response) {
            throw new Error("Missing target gRPC response");
        }

        return new Expectation(path, grpcRequest, response);
    }

    constructor(path, request, response) {
        this.path = path;
        this.request = request;
        this.response = response;
    }

    match(path, request) {
        if (path !== this.path) {
            throw new Mismatch(`Expected path ${this.path} does not match actual ${path}`);
        }

        if (request !== this.request) {
            throw new Mismatch(`Expected request ${this.request} does not match actual ${request} at path ${path}`);
        }

        return Buffer.from(this.response, 'hex');
    }
}
