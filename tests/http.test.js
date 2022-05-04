const axios = require('axios');
const app = require('../src/app');
const utils = require("./utils");

const port = 8000;
const baseUrl = `http://localhost:${port}`;
const { request, assertResponseEquals } = utils;
const createSession = (id) => utils.createSession(baseUrl, id);

let server;

beforeEach(() => server = app.listen(port));
afterEach(() => server.close());

describe("Session creation", () => {
    test('Session id requirement', async () => {
        const response = await request(axios.post(`${baseUrl}/session`));
        assertResponseEquals(response, 400, { message: "Missing session id" });
    });

    test("Session id format validation", async () => {
        const response = await request(axios.post(`${baseUrl}/session`, { id: 'invalid' }));
        assertResponseEquals(response, 400, { message: "Invalid session id (should be 64 hex chars)" });
    });

    test("Success", async () => {
        const response = await request(axios.post(`${baseUrl}/session`, { id: 'a'.repeat(64) }));
        assertResponseEquals(response, 200, {});
    });

    test("Flushing session errors when specifying its id as previous", async () => {
        const session1Id = 'a'.repeat(64);
        const session2Id = 'b'.repeat(64);

        const unexpectedRequestResponse = await request(axios.get(`${baseUrl}/${session1Id}/unexpectedRequest`));
        assertResponseEquals(unexpectedRequestResponse, 501, {
            message: "There were no expectations for request /unexpectedRequest with {}"
        });

        const errorsResponseBefore = await request(axios.get(`${baseUrl}/errors`, { params: { sessionId: session1Id }}));
        assertResponseEquals(errorsResponseBefore, 200, {
            errors: ["There were no expectations for request /unexpectedRequest with {}"]
        });

        const newSessionResponse = await request(
            axios.post(`${baseUrl}/session`, { id: session2Id, previousId: session1Id })
        );
        assertResponseEquals(newSessionResponse, 200, {});

        const errorsResponseAfter = await request(axios.get(`${baseUrl}/errors`, { params: { sessionId: session1Id }}));
        assertResponseEquals(errorsResponseAfter, 400, { message: "Session with such id does not exist" });
    });
});

describe("Requesting errors", () => {
    test("Session id is required when requesting errors", async () => {
        const response = await request(axios.get(`${baseUrl}/errors`));
        assertResponseEquals(response, 400, { message: "Missing session id in request" });
    });
});

describe('Expectation creation', function () {
    test("Session id requirement", async () => {
        const response = await request(axios.put(`${baseUrl}/expectation`));
        assertResponseEquals(response, 400, { message: 'Session id must be set' });
    });

    test("Session existence validation", async () => {
        const response = await request(axios.put(`${baseUrl}/expectation`, { sessionId: 'a'.repeat(64) }));
        assertResponseEquals(response, 400, { message: 'Session with such id does not exist' });
    });

    test("Required fields validation", async () => {
        const sessionId = 'a'.repeat(64);
        await createSession(sessionId);

        const response = await request(axios.put(`${baseUrl}/expectation`, { sessionId }));
        assertResponseEquals(response, 400, { message: 'Missing required fields' });
    });

    test("Create expectation for the specified session", async () => {
        const session1Id = 'a'.repeat(64);
        const session2Id = 'b'.repeat(64);

        await createSession(session1Id);
        await createSession(session2Id);

        const response = await request(axios.put(`${baseUrl}/expectation`, {
            sessionId: session1Id,
            path: '/somePath',
            method: 'POST',
            body: { key: "value" },
            response: { body: {}, code: 200 }
        }));

        assertResponseEquals(response, 200, {});

        const session1ErrorsResponse = await request(axios.get(`${baseUrl}/errors?sessionId=${session1Id}`));
        assertResponseEquals(session1ErrorsResponse, 200, {
            errors: ["Expectation list is not empty: /somePath with {\n  \"key\": \"value\"\n}"]
        });

        const session2ErrorsResponse = await request(axios.get(`${baseUrl}/errors?sessionId=${session2Id}`));
        assertResponseEquals(session2ErrorsResponse, 200, { errors: [] });
    });
});

describe("Flushing state", () => {
    test("Flush all errors", async () => {
        const sessionId = 'a'.repeat(64);
        await createSession(sessionId);

        const unexpectedRequestResponse = await request(axios.get(`${baseUrl}/${sessionId}/unexpectedRequest`));
        assertResponseEquals(unexpectedRequestResponse, 501, {
            message: "There were no expectations for request /unexpectedRequest with {}"
        });

        const errorsResponseBefore = await request(axios.get(`${baseUrl}/errors`, { params: { sessionId }}));
        assertResponseEquals(errorsResponseBefore, 200, {
            errors: ["There were no expectations for request /unexpectedRequest with {}"]
        });

        const flushResponse = await request(axios.delete(`${baseUrl}/flush`));
        assertResponseEquals(flushResponse, 205, {});

        const errorsResponseAfter = await request(axios.get(`${baseUrl}/errors`, { params: { sessionId }}));
        assertResponseEquals(errorsResponseAfter, 400, { message: "Session with such id does not exist" });
    });
});

describe("Matching", () => {
    const sessionId = 'a'.repeat(64);
    const createExpectation = async (expectationData) => {
        const response = await request(axios.put(`${baseUrl}/expectation`, { ...expectationData, sessionId }));
        assertResponseEquals(response, 200, {});
    };

    test("Nonexistent session", async () => {
        const response = await request(axios.get(`${baseUrl}/${'a'.repeat(64)}/`));
        assertResponseEquals(response, 501, { message: "Session with such id does not exist" });
    });

    test("No expectations for request", async () => {
        await createSession(sessionId);
        const response = await request(axios.get(`${baseUrl}/${sessionId}`));
        assertResponseEquals(response, 501, { message: "There were no expectations for request / with {}" });
    });

    test("Method does not match expected", async () => {
        await createSession(sessionId);
        await createExpectation({
            path: "/somepath",
            method: "POST",
            body: {},
            response: {},
        });

        const response = await request(axios.put(`${baseUrl}/${sessionId}/`));
        assertResponseEquals(response, 501, { message: "Expected method POST does not match actual PUT" });
    });

    test("Path does not match expected", async () => {
        await createSession(sessionId);
        await createExpectation({
            path: "/somepath",
            method: "POST",
            body: {},
            response: {},
        });

        const response = await request(axios.post(`${baseUrl}/${sessionId}`));
        assertResponseEquals(response, 501, { message: "Expected path /somepath does not match actual / {}" });
    });

    test("Raw body does not match expected", async () => {
        await createSession(sessionId);
        await createExpectation({
            path: "/somepath",
            method: "POST",
            body: "some body",
            response: {},
            raw: true
        });

        const response = await request(axios.post(`${baseUrl}/${sessionId}/somepath`, "another body"));
        assertResponseEquals(response, 501, {
            message: "Expected raw body some body does not match actual another body"
        });
    });

    test("Raw body matches expected", async () => {
        await createSession(sessionId);
        await createExpectation({
            path: "/somepath",
            method: "POST",
            body: "some body",
            response: {},
            raw: true
        });

        const response = await request(axios.post(`${baseUrl}/${sessionId}/somepath`, "some body"));
        assertResponseEquals(response, 200, "");
    });

    test("JSON body does not match expected", async () => {
        await createSession(sessionId);
        await createExpectation({
            path: "/somepath",
            method: "POST",
            body: { "key": "value" },
            response: {},
        });

        const response = await request(axios.post(`${baseUrl}/${sessionId}/somepath`, { key: 'other value' }));
        assertResponseEquals(response, 501, {
            message: "Expected request body {\n  \"key\": \"value\"\n} does not match actual {\n  \"key\": \"other value\"\n}"
        });
    });

    test("JSON body matches expected", async () => {
        await createSession(sessionId);
        await createExpectation({
            path: "/somepath",
            method: "POST",
            body: { key: { childKey: "value" } },
            response: { code: 400, body: { response: "response" }},
        });

        const response = await request(axios.post(`${baseUrl}/${sessionId}/somepath`, { key: { childKey: "value" } }));
        assertResponseEquals(response, 400, { response: "response" });
    });

    test("Skip optional fields", async () => {
        await createSession(sessionId);
        await createExpectation({
            path: "somepath",
            method: "POST",
            body: { key: { childKey: "value" } },
            response: { body: { response: "response" }},
            optionalFields: ["key.optionalKey", "^"],
        });

        const response = await request(axios.post(`${baseUrl}/${sessionId}/somepath`, { key: { childKey: "value", optionalKey: "some value" } }));
        assertResponseEquals(response, 200, { response: "response" });
    });
});
