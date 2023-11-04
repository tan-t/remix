import { Readable } from "node:stream";
import {
  createReadableStreamFromReadable,
  createRequestHandler as createRemixRequestHandler,
} from "@remix-run/node";

import {
  createRequestHandler,
} from "../server";
import { Hono } from "hono";

// We don't want to test that the remix server works here (that's what the
// playwright tests do), we just want to test the Hono adapter
jest.mock("@remix-run/node", () => {
  let original = jest.requireActual("@remix-run/node");
  return {
    ...original,
    createRequestHandler: jest.fn(),
  };
});
let mockedCreateRequestHandler =
  createRemixRequestHandler as jest.MockedFunction<
    typeof createRemixRequestHandler
  >;

function createApp() {
  let app = new Hono();

  app.all(
    "*",
    // We don't have a real app to test, but it doesn't matter. We won't ever
    // call through to the real createRequestHandler
    // @ts-expect-error
    createRequestHandler({ build: undefined })
  );

  return app;
}

describe("Hono createRequestHandler", () => {
  describe("basic requests", () => {
    afterEach(() => {
      mockedCreateRequestHandler.mockReset();
    });

    afterAll(() => {
      jest.restoreAllMocks();
    });

    it("handles requests", async () => {
      const stub = mockedCreateRequestHandler.mockImplementation(() => async (req) => {
        return new Response(`URL: ${new URL(req.url).pathname}`);
      });

      const app = createApp();
      const res = await app.request("/foo/bar");

      expect(stub).toBeCalled();
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("URL: /foo/bar");
      expect(res.headers.get("x-powered-by")).toBe("Hono");
    });

    it("handles root // URLs", async () => {
      mockedCreateRequestHandler.mockImplementation(() => async (req) => {
        return new Response("URL: " + new URL(req.url).pathname);
      });

      const app = createApp();
      const res = await app.request("//");

      expect(res.status).toBe(200);
      expect(await res.text()).toBe("URL: //");
    });

    it("handles nested // URLs", async () => {
      mockedCreateRequestHandler.mockImplementation(() => async (req) => {
        return new Response("URL: " + new URL(req.url).pathname);
      });

      const app = createApp();
      const res = await app.request("//foo//bar");

      expect(res.status).toBe(200);
      expect(await res.text()).toBe("URL: //foo//bar");
    });

    it("handles null body", async () => {
      mockedCreateRequestHandler.mockImplementation(() => async () => {
        return new Response(null, { status: 200 });
      });

      const app = createApp();
      const res = await app.request("/");

      expect(res.status).toBe(200);
    });

    // https://github.com/node-fetch/node-fetch/blob/4ae35388b078bddda238277142bf091898ce6fda/test/response.js#L142-L148
    it("handles body as stream", async () => {
      mockedCreateRequestHandler.mockImplementation(() => async () => {
        let readable = Readable.from("hello world");
        let stream = createReadableStreamFromReadable(readable);
        return new Response(stream, { status: 200 });
      });

      const app = createApp();
      const res = await app.request("/");
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("hello world");
    });

    it("handles status codes", async () => {
      mockedCreateRequestHandler.mockImplementation(() => async () => {
        return new Response(null, { status: 204 });
      });

      const app = createApp();
      const res = await app.request("/");

      expect(res.status).toBe(204);
    });

    it("sets headers", async () => {
      mockedCreateRequestHandler.mockImplementation(() => async () => {
        let headers = new Headers({ "X-Time-Of-Year": "most wonderful" });
        headers.append(
          "Set-Cookie",
          "first=one; Expires=0; Path=/; HttpOnly; Secure; SameSite=Lax"
        );
        headers.append(
          "Set-Cookie",
          "second=two; MaxAge=1209600; Path=/; HttpOnly; Secure; SameSite=Lax"
        );
        headers.append(
          "Set-Cookie",
          "third=three; Expires=Wed, 21 Oct 2015 07:28:00 GMT; Path=/; HttpOnly; Secure; SameSite=Lax"
        );
        return new Response(null, { headers });
      });

      const app = createApp();
      const res = await app.request("/");

      expect(res.headers.get("x-time-of-year")).toBe("most wonderful");
      expect(res.headers.get("set-cookie")).toEqual(
        "first=one; Expires=0; Path=/; HttpOnly; Secure; SameSite=Lax, " +
        "second=two; MaxAge=1209600; Path=/; HttpOnly; Secure; SameSite=Lax, " +
        "third=three; Expires=Wed, 21 Oct 2015 07:28:00 GMT; Path=/; HttpOnly; Secure; SameSite=Lax",
      );
    });
  });
});


