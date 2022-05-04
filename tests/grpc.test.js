const axios = require("axios");
const grpc = require("@grpc/grpc-js");

const utils = require("./utils");
const app = require("../src/app");
const State = require("../src/State");
const createServer = require("../src/Grpc/createServer");

const port = 8001;
const baseUrl = `http://localhost:${port}`;
const { request, assertResponseEquals } = utils;
const createSession = (id, previousId) => utils.createSession(baseUrl, id, previousId);

let server;

beforeEach(() => server = app.listen(port));
afterEach(() => {
    server.close();
    Object.values(State.instance.sessions)
        .forEach((session) => session.grpcServer && session.grpcServer.instance.forceShutdown());
});

describe("Validation during enabling gRPC", () => {
    test("Session id requirement", async () => {
        const response = await request(axios.post(`${baseUrl}/grpc/enable`));
        assertResponseEquals(response, 400, { message: "Session id must be set" });
    });

    test("Session existence validation", async () => {
        const response = await request(axios.post(`${baseUrl}/grpc/enable`, { sessionId: 'a'.repeat(64) }));
        assertResponseEquals(response, 400, { message: "Session with such id does not exist" });
    });

    test("Enabling gRPC for sessions", async () => {
        const session1Id = 'a'.repeat(64);
        const session2Id = 'b'.repeat(64);
        await createSession(session1Id);
        await createSession(session2Id);

        const response1 = await request(axios.post(`${baseUrl}/grpc/enable`, { sessionId: session1Id }));
        assertResponseEquals(response1, 200, { port: 50051 });

        expect(State.instance.sessions[session1Id]).toBeDefined();
        expect(State.instance.sessions[session1Id].grpcServer).toBeDefined();

        const response2 = await request(axios.post(`${baseUrl}/grpc/enable`, { sessionId: session2Id }));
        assertResponseEquals(response2, 200, { port: 50052 });

        expect(State.instance.sessions[session1Id]).toBeDefined();
        expect(State.instance.sessions[session1Id].grpcServer).toBeDefined();
        expect(State.instance.sessions[session2Id]).toBeDefined();
        expect(State.instance.sessions[session2Id].grpcServer).toBeDefined();

        const response2Duplicated = await request(axios.post(`${baseUrl}/grpc/enable`, { sessionId: session2Id }));
        assertResponseEquals(response2Duplicated, 200, { port: 50052 });

        const session3Id = 'c'.repeat(64);
        await createSession(session3Id, session2Id);

        expect(State.instance.sessions[session1Id]).toBeDefined();
        expect(State.instance.sessions[session1Id].grpcServer).toBeDefined();
        expect(State.instance.sessions[session2Id]).toBeUndefined();
        expect(State.instance.sessions[session3Id]).toBeDefined();
        expect(State.instance.sessions[session3Id].grpcServer).toBeUndefined();

        const otherServer = createServer();
        const creationPromise = new Promise((resolve, reject) => {
            otherServer.bindAsync("127.0.0.1:50052", grpc.ServerCredentials.createInsecure(), () => {
                try {
                    otherServer.start();
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
        });

        await creationPromise;

        const response3 = await request(axios.post(`${baseUrl}/grpc/enable`, { sessionId: session3Id }));
        otherServer.forceShutdown();

        assertResponseEquals(response3, 500, { message: "Failed to start gRPC server" });
    });
});

describe("New expectations validation", () => {
    test("Missing path in request", async () => {
        const sessionId = 'a'.repeat(64);
        await createSession(sessionId);

        const response = await request(axios.put(`${baseUrl}/expectation/grpc`, { sessionId }));
        assertResponseEquals(response, 400, { message: "Missing expected gRPC path" });
    });

    test("Missing expected gRPC request", async () => {
        const sessionId = 'a'.repeat(64);
        await createSession(sessionId);

        const response = await request(axios.put(`${baseUrl}/expectation/grpc`, { sessionId, path: "" }));
        assertResponseEquals(response, 400, { message: "Missing expected gRPC request" });
    });

    test("Missing target gRPC response", async () => {
        const sessionId = 'a'.repeat(64);
        await createSession(sessionId);

        const response = await request(axios.put(`${baseUrl}/expectation/grpc`, { sessionId, path: "", request: "" }));
        assertResponseEquals(response, 400, { message: "Missing target gRPC response" });
    });

    test("Create new expectation and get it in errors", async () => {
        const sessionId = 'a'.repeat(64);
        await createSession(sessionId);

        const expectationResponse = await request(axios.put(`${baseUrl}/expectation/grpc`, {
            sessionId,
            path: "",
            request: "",
            response: "",
        }));

        assertResponseEquals(expectationResponse, 200, {});

        const errorsResponse = await request(axios.get(`${baseUrl}/errors?sessionId=${sessionId}`));
        assertResponseEquals(errorsResponse, 200, {
            errors: ["gRPC expectations list is not empty: path \"\" with \"\""],
        });
    });
});

describe("Matching gRPC requests", () => {
    const ClientConstructor = grpc.makeClientConstructor({
        method: {
            path: '/test',
            requestSerialize: (value) => Buffer.from(value, 'hex'),
            requestDeserialize: (value) => value.toString('hex'),
            responseSerialize: (value) => Buffer.from(value, 'hex'),
            responseDeserialize: (value) => value.toString('hex'),
            requestStream: false,
            responseStream: false,
        }
    }, 'TestService');

    const client = new ClientConstructor("localhost:50051", grpc.credentials.createInsecure());

    const callGrpc = (param) => new Promise((resolve) => {
        client["method"](param, (error, response) => {
            resolve(error || response);
        });
    });

    test("No expectations for gRPC requests", async () => {
        const sessionId = 'a'.repeat(64);
        await createSession(sessionId);
        const grpcEnableResponse = await request(axios.post(`${baseUrl}/grpc/enable`, { sessionId }));
        assertResponseEquals(grpcEnableResponse, 200, { port: 50051 });

        const grpcResponse = await callGrpc("1111");
        expect(grpcResponse).toEqual("");

        const errorsResponse = await request(axios.get(`${baseUrl}/errors?sessionId=${sessionId}`));
        assertResponseEquals(errorsResponse, 200, {
            errors: ["There were no expectations for gRPC request to /test with 1111"],
        });
    });

    test("Path does not match expected value", async () => {
        const sessionId = 'a'.repeat(64);
        await createSession(sessionId);
        const grpcEnableResponse = await request(axios.post(`${baseUrl}/grpc/enable`, { sessionId }));
        assertResponseEquals(grpcEnableResponse, 200, { port: 50051 });

        const expectationResponse = await request(axios.put(`${baseUrl}/expectation/grpc`, {
            sessionId,
            path: "/test/other/path",
            request: "",
            response: "123456"
        }));

        assertResponseEquals(expectationResponse, 200, {});

        const grpcResponse = await callGrpc("1111");
        expect(grpcResponse).toEqual("");

        const errorsResponse = await request(axios.get(`${baseUrl}/errors?sessionId=${sessionId}`));
        assertResponseEquals(errorsResponse, 200, {
            errors: ["Expected path /test/other/path does not match actual /test"],
        });
    });

    test("Request body does not match expected value", async () => {
        const sessionId = 'a'.repeat(64);
        await createSession(sessionId);
        const grpcEnableResponse = await request(axios.post(`${baseUrl}/grpc/enable`, { sessionId }));
        assertResponseEquals(grpcEnableResponse, 200, { port: 50051 });

        const expectationResponse = await request(axios.put(`${baseUrl}/expectation/grpc`, {
            sessionId,
            path: "/test",
            request: "1122",
            response: "123456"
        }));

        assertResponseEquals(expectationResponse, 200, {});

        const grpcResponse = await callGrpc("1111");
        expect(grpcResponse).toEqual("");

        const errorsResponse = await request(axios.get(`${baseUrl}/errors?sessionId=${sessionId}`));
        assertResponseEquals(errorsResponse, 200, {
            errors: ["Expected request 1122 does not match actual 1111 at path /test"],
        });
    });

    test("Everything matches", async () => {
        const sessionId = 'a'.repeat(64);
        await createSession(sessionId, 'd'.repeat(64));
        const grpcEnableResponse = await request(axios.post(`${baseUrl}/grpc/enable`, { sessionId }));
        assertResponseEquals(grpcEnableResponse, 200, { port: 50051 });

        const expectationResponse = await request(axios.put(`${baseUrl}/expectation/grpc`, {
            sessionId,
            path: "/test",
            request: "1122",
            response: "123456"
        }));

        assertResponseEquals(expectationResponse, 200, {});

        const grpcResponse = await callGrpc("1122");
        expect(grpcResponse).toEqual("123456");

        const errorsResponse = await request(axios.get(`${baseUrl}/errors?sessionId=${sessionId}`));
        assertResponseEquals(errorsResponse, 200, { errors: [] });
    });
});
