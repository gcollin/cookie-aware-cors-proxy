import { chromeEngine } from "../src/chrome-engine/chromeEngine";

const CHROME_EXEC = process.env.CACP_CHROME_EXEC;

describe("Chrome tests", () => {
  const TEST_SERVER_URL = "http://localhost:3000/proxy/debug";

  it("should work", () => {
    expect(chromeEngine).toBeDefined();
  });

  it("supports direct calls", (done) => {
    chromeEngine
      .request(
        "chrome",
        {
          url: process.env.SERVER_ADDRESS + "/index.html",
          method: "get",
        },
        false,
        CHROME_EXEC
      )
      .then((response) => {
        expect(response.status).toEqual(200);
        expect(response.data).toContain("Test Title");
        done();
      })
      .catch((error: Error) => {
        done(error);
      });

    // Redirects a directly handled...
    chromeEngine
      .request(
        "chrome",
        {
          url: process.env.SERVER_ADDRESS + "/redirect/index.html",
          method: "get",
        },
        true,
        CHROME_EXEC
      )
      .then((response) => {
        expect(response.status).toEqual(200);
        expect(response.data).toContain("Test Title");
        done();
      })
      .catch((error: Error) => {
        done(error);
      });
  });

/*  it("supports engine value", async () => {
    let response = await axios.request({
      url: TEST_SERVER_URL + "/" + process.env.SERVER_ADDRESS + "/index.html",
      params: {
        engine: "chrome",
      },
      method: "get",
    });

    expect(response.status).toBe(200);
    expect(response.data).toContain("Test Title");

    // Test redirects with / notation for url
    response = await axios.request({
      url:
        TEST_SERVER_URL +
        "/" +
        process.env.SERVER_ADDRESS +
        "/redirect/index.html",
      params: {
        engine: "chrome",
      },
      method: "get",
      maxRedirects: 0,
    });
    // Redirects are directly handled by Chrome
    expect(response.status).toBe(200);
    expect(response.data).toContain("Test Title");
  });

  it("supports redirect with url notation", async () => {
    // Test redirect with parameters for url
    const response = await axios.request({
      url: TEST_SERVER_URL + "/",
      params: {
        url: process.env.SERVER_ADDRESS + "/redirect/index.html",
        engine: "chrome",
      },
      method: "get",
      maxRedirects: 0,
    });
    // Redirects are directly handled by Chrome
    expect(response.status).toBe(200);
    expect(response.data).toContain("Test Title");
  });

  it("supports cookies value", async () => {
    // Test redirect with parameters for url
    const response = await axios.request({
      url: TEST_SERVER_URL + "/",
      params: {
        url: process.env.SERVER_ADDRESS + "/cookie/index.html",
        engine: "chrome",
      },
      method: "get",
      maxRedirects: 0,
    });
    // Redirects are directly handled by Chrome
    expect(response.status).toBe(200);
    expect(response.data).toContain("Test Title");
    expect(response.headers["set-cookie"]).toHaveLength(3);
  });
  */
});
