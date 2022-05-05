const { Server } = require("@grpc/grpc-js");
const Expectation = require("./Expectation");
const Mismatch = require("../Mismatch");
const State = require("../State");

class WrappedMap extends Map {
    port;

    constructor(port) {
        super();
        this.port = port;
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
        const session = Object.values(State.instance.sessions).filter((session) => session.grpcPort === this.port)[0];
        if (!session) {
            return Buffer.alloc(0);
        }

        const expectation = session.grpcExpectations.shift();
        if (!(expectation instanceof Expectation)) {
            session.errors.push(`There were no expectations for gRPC request to "${path}" with "${requestHex}"`);
            return Buffer.alloc(0);
        }

        try {
            return expectation.match(path, requestHex);
        } catch (error) {
            if (!(error instanceof Mismatch)) {
                throw error;
            }

            session.errors.push(error.message);
            return Buffer.alloc(0);
        }
    }
}

module.exports = (session) => {
    const server = new Server();
    server.handlers = new WrappedMap(session);

    return server;
};
