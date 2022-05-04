module.exports = class Server {
    instance;
    port;

    constructor(instance, port) {
        this.instance = instance;
        this.port = port;
    }
}
