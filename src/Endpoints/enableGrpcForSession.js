const State = require("../State");
const Grpc = require("../Grpc");
const { ServerCredentials } = require("@grpc/grpc-js");

const MIN_PORT = 50051;
const MAX_PORT = 65535;

const findFreePort = () => {
    for (let port = MIN_PORT; port <= MAX_PORT; port++) {
        let isUsed = Object.values(State.instance.sessions)
            .some((session) => session.grpcServer && (session.grpcServer.port === port));

        if (!isUsed) {
            return port;
        }
    }

    throw new Error(`Failed to find a free port in range [${MIN_PORT};${MAX_PORT}]`)
};

module.exports = async (request, response) => {
    const { sessionId } = request.body;
    if (!sessionId) {
        response.status(400).json({ message: 'Session id must be set' });
        return;
    }

    const session = State.instance.getSessionById(sessionId);
    if (!session) {
        response.status(400).json({ message: 'Session with such id does not exist' });
        return;
    }

    if (!session.grpcServer) {
        const port = findFreePort();
        const instance = Grpc.createServer(session);
        session.grpcServer = new Grpc.Server(instance, port);

        const creationPromise = new Promise((resolve, reject) => {
            instance.bindAsync("127.0.0.1:" + port, ServerCredentials.createInsecure(), () => {
                try {
                    instance.start();
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
        });

        try {
            await creationPromise;
        } catch (error) {
            response.status(500).json({ message: "Failed to start gRPC server" });
            return;
        }
    }

    response.status(200).json({ port: session.grpcServer.port });
};
