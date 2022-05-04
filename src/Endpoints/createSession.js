const State = require("../State");

module.exports = (request, response) => {
    const { id, previousId } = request.body;
    if (!id) {
        response.status(400).json({ message: 'Missing session id' });
        return;
    }

    if (!id.match(/^[a-z0-9]{64}$/)) {
        response.status(400).json({ message: 'Invalid session id (should be 64 hex chars)'})
        return;
    }

    if (previousId) {
        State.instance.deleteSession(previousId);
    }

    State.instance.createSession(id);

    response.status(200).json({});
};
