const State = require("../State");
const Mismatch = require("../Mismatch");
const Expectation = require("../Http/Expectation");

module.exports = (request, response) => {
    const sessionId = request.originalUrl.substring(1, 65);
    const session = State.instance.getSessionById(sessionId);
    if (!session) {
        response.status(501).json({ message: "Session with such id does not exist" });
        return;
    }

    // Getting next expectation from queue
    const expectation = session.httpExpectations.shift();
    if (!(expectation instanceof Expectation)) {
        const path = request.originalUrl.substr(65).replace(/\/$/, '') || '/';
        const actualBodyString = JSON.stringify(request.body, undefined, 2);
        const message = `There were no expectations for request ${path} with ${actualBodyString}`;

        session.errors.push(message);
        response.status(501).json({ message });
        return;
    }

    try {
        const matchedResponse = expectation.match(request);
        response.status(matchedResponse.code).json(matchedResponse.body);
    } catch (error) {
        if (!(error instanceof Mismatch)) {
            throw error;
        }

        session.errors.push(error.message);
        response.status(501).json({ message: error.message });
    }
};
