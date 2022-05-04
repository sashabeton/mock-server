const State = require("../State");

module.exports = (request, response) => {
    const sessionId = request.query.sessionId;
    if (!sessionId) {
        response.status(400).json({ message: 'Missing session id in request' });
        return;
    }

    const session = State.instance.getSessionById(sessionId);
    if (!session) {
        response.status(400).json({ message: "Session with such id does not exist" });
        return;
    }

    const targetErrors = [...session.errors];

    if (session.httpExpectations.length > 0 && targetErrors.length === 0) {
        const unusedExpectations = session.httpExpectations
            .map((e) => `${e.path} with ${JSON.stringify(e.body, undefined, 2)}`);

        targetErrors.push(`Expectation list is not empty: ${unusedExpectations}`);
    }

    if (session.grpcExpectations.length > 0 && targetErrors.length === 0) {
        const unusedExpectations = session.grpcExpectations.map((e) => `path "${e.path}" with "${e.request}"`);
        targetErrors.push(`gRPC expectations list is not empty: ${unusedExpectations}`);
    }

    response.json({ errors: targetErrors });
};
