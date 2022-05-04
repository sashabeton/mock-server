const State = require("../State");
const HttpExpectation = require("../Http/Expectation");
const GrpcExpectation = require("../Grpc/Expectation");

module.exports = (type) => (request, response) => {
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

    try {
        if (type === "http") {
            session.httpExpectations.push(HttpExpectation.fromRequest(request))
        } else if (type === "grpc") {
            session.grpcExpectations.push(GrpcExpectation.fromRequest(request))
        }

        response.json({});
    } catch (error) {
        response.status(400).json({ message: error.message });
    }
};
