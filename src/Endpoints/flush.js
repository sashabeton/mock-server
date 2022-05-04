const State = require("../State");

module.exports = (request, response) => {
    State.instance.flush();

    response.status(205).json({});
};
