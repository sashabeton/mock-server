module.exports = (state) => (request, response) => {
    state.flush();

    response.status(205).json({});
};
