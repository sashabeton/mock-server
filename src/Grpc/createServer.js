const { Server } = require("@grpc/grpc-js");
const Expectation = require("./Expectation");
const Mismatch = require("../Mismatch");

class WrappedMap extends Map {
    /** @type {Session} */
    session;

    /** @param {Session} session */
    constructor(session) {
        super();
        this.session = session;
    }

    get(key) {
        return {
            func: this.handle(key),
            serialize: (v) => v,
            deserialize: (v) => v,
            type: "unary",
        };
    }

    handle = (path) => (_, callback) => {
        /** @type {Buffer} */
        const request = _.request;
        const requestHex = request.toString('hex');

        callback(null, this.match(path, requestHex));
    };

    match = (path, requestHex) => {
        const expectation = this.session.grpcExpectations.shift();
        if (!(expectation instanceof Expectation)) {
            this.session.errors.push(`There were no expectations for gRPC request to ${path} with ${requestHex}`);
            return new Buffer([]);
        }

        try {
            return expectation.match(path, requestHex);
        } catch (error) {
            if (!(error instanceof Mismatch)) {
                throw error;
            }

            this.session.errors.push(error.message);
            return new Buffer([]);
        }
    }
}

module.exports = (session) => {
    const server = new Server();
    server.handlers = new WrappedMap(session);

    return server;
};
