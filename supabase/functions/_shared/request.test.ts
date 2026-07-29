// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  fetchWithTimeout,
  PayloadTooLargeError,
  readJsonBody,
  UpstreamTimeoutError,
} from "./request.ts";

describe("readJsonBody", () => {
  it("parse un corps JSON sous la limite", async () => {
    const request = new Request("https://example.test", {
      method: "POST",
      body: JSON.stringify({ message: "Bonjour" }),
    });

    await expect(readJsonBody(request, 1024)).resolves.toEqual({
      message: "Bonjour",
    });
  });

  it("rejette immédiatement un Content-Length supérieur à la limite", async () => {
    const request = new Request("https://example.test", {
      method: "POST",
      headers: { "Content-Length": "2048" },
      body: "{}",
    });

    await expect(readJsonBody(request, 1024)).rejects.toBeInstanceOf(
      PayloadTooLargeError,
    );
  });

  it("rejette un flux qui dépasse la limite sans Content-Length", async () => {
    const request = new Request("https://example.test", {
      method: "POST",
      body: JSON.stringify({ message: "x".repeat(2048) }),
    });

    await expect(readJsonBody(request, 1024)).rejects.toBeInstanceOf(
      PayloadTooLargeError,
    );
  });
});

describe("fetchWithTimeout", () => {
  it("interrompt un appel amont qui dépasse le délai", async () => {
    const stalledFetch: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(init.signal?.reason);
        });
      });

    await expect(
      fetchWithTimeout(
        "https://example.test",
        {},
        5,
        stalledFetch,
      ),
    ).rejects.toBeInstanceOf(UpstreamTimeoutError);
  });
});
