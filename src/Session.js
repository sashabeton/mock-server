module.exports = class Session {
    /** @type {string} */
    id;
    /** @type {Array.<string>} */
    errors;
    /** @type {Array.<Expectation>} */
    httpExpectations;

    constructor(id) {
        this.id = id;
        this.errors = [];
        this.httpExpectations = [];
    }
}
