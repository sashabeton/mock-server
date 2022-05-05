module.exports = class Session {
    /** @type {string} */
    id;
    /** @type {Array.<string>} */
    errors;
    /** @type {Array.<Expectation>} */
    httpExpectations;
    /** @type {Array.<Expectation>} */
    grpcExpectations;
    /** @type number */
    grpcPort;

    constructor(id) {
        this.id = id;
        this.errors = [];
        this.httpExpectations = [];
        this.grpcExpectations = [];
    }
}
