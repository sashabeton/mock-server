module.exports = (state) => (request, response) => {
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
        state.deleteSession(previousId);
    }

    state.createSession(id);

    response.status(200).json({});
};
