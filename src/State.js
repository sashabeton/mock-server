const Session = require("./Session");

module.exports = class State {
    sessions;

    constructor() {
        this.sessions = {};
    }

    /** @return {Session|undefined} */
    getById = (id) => {
        return this.sessions[id];
    }

    createSession = (id) => {
        this.sessions[id] = new Session(id);
    }

    deleteSession = (id) => {
        delete this.sessions[id];
    }

    flush = () => {
        this.sessions = {};
    }
}
