import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

/** Node/OpenSSL falha com ECONNRESET em *.supabase.co neste Windows; Schannel (PowerShell) funciona. */
export function shouldUseWinFetch(url: string): boolean {
  return (
    process.platform === "win32" &&
    process.env.NODE_ENV === "development" &&
    url.includes(".supabase.co")
  );
}

const WIN_MAX_CONCURRENT = 2;
const WIN_RETRIES = 4;
let winActive = 0;
const winWaiters: Array<() => void> = [];

function acquireWin(): Promise<void> {
  if (winActive < WIN_MAX_CONCURRENT) {
    winActive++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    winWaiters.push(() => {
      winActive++;
      resolve();
    });
  });
}

function releaseWin() {
  winActive = Math.max(0, winActive - 1);
  const next = winWaiters.shift();
  if (next) next();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runProcess(
  cmd: string,
  args: string[],
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ stdout, stderr, code: code ?? 1 }));
  });
}

async function winFetchOnce(url: string, init?: RequestInit): Promise<Response> {
  const dir = await mkdtemp(join(tmpdir(), "moovifly-sb-"));
  const reqFile = join(dir, "request.json");

  try {
    const method = (init?.method ?? "GET").toUpperCase();
    const headers: Record<string, string> = {};
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => {
        headers[key] = value;
      });
    }

    let body: string | undefined;
    let contentType: string | undefined;
    if (init?.body && method !== "GET" && method !== "HEAD") {
      if (typeof init.body === "string") body = init.body;
      else if (init.body instanceof ArrayBuffer) body = Buffer.from(init.body).toString("utf8");
      else if (init.body instanceof Uint8Array) body = Buffer.from(init.body).toString("utf8");
      else body = await new Response(init.body as BodyInit).text();
      contentType = headers["Content-Type"] ?? headers["content-type"] ?? "application/json";
    }

    await writeFile(reqFile, JSON.stringify({ url, method, headers, body, contentType }), "utf8");

    const scriptPath = join(process.cwd(), "scripts", "win-supabase-fetch.ps1");
    const { stdout, stderr, code } = await runProcess("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
      reqFile,
    ]);

    if (code !== 0) {
      throw new Error(stderr.trim() || stdout.trim() || `powershell exit ${code}`);
    }

    const parsed = JSON.parse(stdout.trim()) as {
      ok?: boolean;
      status?: number;
      headers?: Record<string, string>;
      body?: string;
      error?: string;
    };

    if (parsed.ok === false || parsed.error) {
      throw new Error(parsed.error ?? "powershell fetch failed");
    }

    const status = parsed.status ?? 500;
    const bodyBuf = parsed.body ? Buffer.from(parsed.body, "base64") : Buffer.alloc(0);
    const responseHeaders = new Headers();
    for (const [key, value] of Object.entries(parsed.headers ?? {})) {
      if (value) responseHeaders.set(key, value);
    }

    return new Response(bodyBuf, { status, headers: responseHeaders });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function winFetch(url: string, init?: RequestInit): Promise<Response> {
  await acquireWin();
  try {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < WIN_RETRIES; attempt++) {
      try {
        return await winFetchOnce(url, init);
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        if (attempt < WIN_RETRIES - 1) {
          await sleep(200 * (attempt + 1));
        }
      }
    }
    throw lastError ?? new Error("win fetch failed");
  } finally {
    releaseWin();
  }
}

export async function supabaseFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url =
    typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

  if (shouldUseWinFetch(url)) {
    try {
      return await winFetch(url, init);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      throw new TypeError(`fetch failed: ${message}`);
    }
  }

  return fetch(input, init);
}
