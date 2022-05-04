const Expectation = require("../Http/Expectation");

module.exports = (state) => (request, response) => {
    const { sessionId } = request.body;
    if (!sessionId) {
        response.status(400).json({ message: 'Session id must be set' });
        return;
    }

    const session = state.getById(sessionId);
    if (!session) {
        response.status(400).json({ message: 'Session with such id does not exist' });
        return;
    }

    try {
        session.httpExpectations.push(Expectation.fromRequest(request));
        response.json({});
    } catch (error) {
        response.status(400).json({ message: error.message });
    }
}
