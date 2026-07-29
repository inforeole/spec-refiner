export class PayloadTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`Corps supérieur à la limite de ${maxBytes} octets`);
    this.name = "PayloadTooLargeError";
  }
}

export class UpstreamTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Délai amont dépassé après ${timeoutMs} ms`);
    this.name = "UpstreamTimeoutError";
  }
}

export async function readJsonBody(
  request: Request,
  maxBytes: number,
): Promise<unknown> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new PayloadTooLargeError(maxBytes);
  }

  const reader = request.body?.getReader();
  if (!reader) {
    return JSON.parse("");
  }

  const decoder = new TextDecoder();
  let body = "";
  let receivedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    receivedBytes += value.byteLength;
    if (receivedBytes > maxBytes) {
      await reader.cancel();
      throw new PayloadTooLargeError(maxBytes);
    }
    body += decoder.decode(value, { stream: true });
  }

  body += decoder.decode();
  return JSON.parse(body);
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  const controller = new AbortController();
  const callerSignal = init.signal;
  let timedOut = false;

  const abortFromCaller = () => controller.abort(callerSignal?.reason);
  if (callerSignal?.aborted) {
    abortFromCaller();
  } else {
    callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
  }

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetcher(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) {
      throw new UpstreamTimeoutError(timeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener("abort", abortFromCaller);
  }
}
