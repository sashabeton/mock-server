const Session = require("./Session");

module.exports = class State {
    static _instance;

    /** @type {Object.<string,Session>} */
    sessions;
    /** @type {Array.<Server>} */
    grpcServers;

    /** @returns {State} */
    static get instance() {
        if (!State._instance) {
            State._instance = new State();
        }

        return State._instance;
    }

    constructor() {
        this.sessions = {};
        this.grpcServers = [];
    }

    /** @return {Session|undefined} */
    getSessionById = (id) => this.sessions[id];

    createSession = (id) => this.sessions[id] = new Session(id);

    deleteSession = (id) => {
        delete this.sessions[id];
    }

    flush = () => this.sessions = {};
}
