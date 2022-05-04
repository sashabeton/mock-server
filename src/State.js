const Session = require("./Session");

module.exports = class State {
    static _instance;

    /** @type {Object.<string,Session>} */
    sessions;

    /** @returns {State} */
    static get instance() {
        if (!State._instance) {
            State._instance = new State();
        }

        return State._instance;
    }

    constructor() {
        this.sessions = {};
    }

    /** @return {Session|undefined} */
    getSessionById = (id) => this.sessions[id];

    createSession = (id) => this.sessions[id] = new Session(id);

    deleteSession = (id) => {
        if (!this.sessions[id]) {
            return;
        }

        if (this.sessions[id].grpcServer) {
            this.sessions[id].grpcServer.instance.forceShutdown();
        }

        delete this.sessions[id];
    }

    flush = () => Object.keys(this.sessions).forEach(this.deleteSession);
}
