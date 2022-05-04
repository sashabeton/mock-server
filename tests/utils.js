const axios = require("axios");

const request = async (axiosPromise) => {
    try {
        return await axiosPromise;
    } catch (error) {
        return error.response;
    }
}

const assertResponseEquals = (response, expectedStatus, expectedResponse) => {
    expect(response.status).toEqual(expectedStatus);
    expect(response.data).toEqual(expectedResponse);
};

const createSession = async (baseUrl, id, previousId) => {
    const response = await request(axios.post(`${baseUrl}/session`, { id, previousId }));
    assertResponseEquals(response, 200, {});
};

module.exports = {
    request,
    assertResponseEquals,
    createSession,
};
