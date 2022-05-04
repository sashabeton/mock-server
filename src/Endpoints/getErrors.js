module.exports = (state) => (request, response) => {
    const sessionId = request.query.sessionId;
    if (!sessionId) {
        response.status(400).json({ message: 'Missing session id in request' });
        return;
    }

    const session = state.getById(sessionId);
    if (!session) {
        response.status(400).json({ message: "Session with such id does not exist" });
        return;
    }

    const targetErrors = [...session.errors];
    const sessionExpectations = session.httpExpectations;

    if (sessionExpectations.length > 0 && targetErrors.length === 0) {
        const unusedExpectations = sessionExpectations
            .map((e) => `${e.path} with ${JSON.stringify(e.body, undefined, 2)}`);

        targetErrors.push(`Expectation list is not empty: ${unusedExpectations}`);
    }

    response.json({ errors: targetErrors });
};
