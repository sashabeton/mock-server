module.exports = class Session {
    /** @type {string} */
    id;
    /** @type {Array.<string>} */
    errors;
    /** @type {Array.<Expectation>} */
    httpExpectations;
    /** @type {Array.<Expectation>} */
    grpcExpectations;
    /** @type {Server|undefined} */
    grpcServer;

    constructor(id) {
        this.id = id;
        this.errors = [];
        this.httpExpectations = [];
        this.grpcExpectations = [];
    }
}
