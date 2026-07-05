import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OpenCodeClient, detectDisallowedBashCommand, _testDetectDisallowedBashInRawLine } from "./opencode-client";
import * as childProcess from "child_process";
import * as providers from "../shared/providers";

// Mock child_process so we can inspect spawn calls without real side effects.
vi.mock("child_process", async () => {
  const actual = await vi.importActual<typeof childProcess>("child_process");
  return {
    ...actual,
    spawn: vi.fn(),
    execSync: vi.fn(() => "C:\\Users\\test\\AppData\\Roaming\\npm"),
  };
});

// Mock providers so buildCleanOpenCodeEnv is predictable.
vi.mock("../shared/providers", async () => {
  const actual = await vi.importActual<typeof providers>("../shared/providers");
  return {
    ...actual,
    buildCleanOpenCodeEnv: vi.fn((baseEnv, apiKeys) => ({
      ...baseEnv,
      ...Object.fromEntries(
        Object.entries(apiKeys || {}).map(([k, v]) => [
          k.toUpperCase().replace(/[^A-Z0-9]/g, "_") + "_API_KEY",
          v,
        ])
      ),
    })),
  };
});

function makeMockProc() {
  const stdout = { on: vi.fn() };
  const stderr = { on: vi.fn() };
  const proc = {
    stdout,
    stderr,
    stdin: { write: vi.fn(), end: vi.fn() },
    kill: vi.fn(),
    on: vi.fn(),
  };
  return proc as unknown as childProcess.ChildProcess;
}

describe("OpenCodeClient", () => {
  let client: OpenCodeClient;
  const mockedSpawn = vi.mocked(childProcess.spawn);
  let findBinSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    findBinSpy = vi.spyOn(OpenCodeClient.prototype as any, "findOpenCodeBin").mockReturnValue(null);
    client = new OpenCodeClient("anthropic/claude-3-5-sonnet-20241022", "/tmp/test", {
      anthropic: "sk-test",
    });
  });

  afterEach(() => {
    findBinSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("spawns native .exe directly (no node wrapper)", async () => {
    const binPath = "C:\\Users\\test\\AppData\\Roaming\\npm\\node_modules\\opencode-ai\\bin\\opencode.exe";
    findBinSpy.mockReturnValue(binPath);

    const proc = makeMockProc();
    mockedSpawn.mockReturnValue(proc);

    const promise = client.sendMessage("hello", () => {});
    const closeHandler = (proc.on as any).mock.calls.find((c: any) => c[0] === "close")?.[1];
    if (closeHandler) closeHandler(0);
    await promise;

    expect(mockedSpawn).toHaveBeenCalledTimes(1);
    const [cmd, args, opts] = mockedSpawn.mock.calls[0];
    expect(cmd).toBe(binPath);
    expect(args).toEqual([
      "run",
      "--format", "json",
      "--model", "anthropic/claude-3-5-sonnet-20241022",
      "--agent", "readonly",
    ]);
    expect(opts?.cwd).toBe("/tmp/test");
    expect(opts?.stdio).toEqual(["pipe", "pipe", "pipe"]);
  });

  it("spawns JS shim via node wrapper", async () => {
    const binPath = "C:\\Users\\test\\AppData\\Roaming\\npm\\node_modules\\opencode-ai\\bin\\opencode";
    findBinSpy.mockReturnValue(binPath);

    const proc = makeMockProc();
    mockedSpawn.mockReturnValue(proc);

    const promise = client.sendMessage("hello", () => {});
    const closeHandler = (proc.on as any).mock.calls.find((c: any) => c[0] === "close")?.[1];
    if (closeHandler) closeHandler(0);
    await promise;

    expect(mockedSpawn).toHaveBeenCalledTimes(1);
    const [cmd, args, opts] = mockedSpawn.mock.calls[0];
    expect(cmd).toBe("node");
    expect(args).toEqual([
      binPath,
      "run",
      "--format", "json",
      "--model", "anthropic/claude-3-5-sonnet-20241022",
      "--agent", "readonly",
    ]);
    expect(opts?.cwd).toBe("/tmp/test");
  });

  it("passes --session when sessionId is set", async () => {
    const binPath = "C:\\Users\\test\\AppData\\Roaming\\npm\\node_modules\\opencode-ai\\bin\\opencode.exe";
    findBinSpy.mockReturnValue(binPath);

    client.setRestoredSession("ses_abc123");
    const proc = makeMockProc();
    mockedSpawn.mockReturnValue(proc);

    const promise = client.sendMessage("hello", () => {});
    const closeHandler = (proc.on as any).mock.calls.find((c: any) => c[0] === "close")?.[1];
    if (closeHandler) closeHandler(0);
    await promise;

    const [, args] = mockedSpawn.mock.calls[0];
    expect(args).toContain("--session");
    expect(args[args.indexOf("--session") + 1]).toBe("ses_abc123");
  });

  it("passes --continue on second message without explicit session", async () => {
    const binPath = "C:\\Users\\test\\AppData\\Roaming\\npm\\node_modules\\opencode-ai\\bin\\opencode.exe";
    findBinSpy.mockReturnValue(binPath);

    const proc1 = makeMockProc();
    mockedSpawn.mockReturnValue(proc1);
    const p1 = client.sendMessage("first", () => {});
    const close1 = (proc1.on as any).mock.calls.find((c: any) => c[0] === "close")?.[1];
    if (close1) close1(0);
    await p1;

    const proc2 = makeMockProc();
    mockedSpawn.mockReturnValue(proc2);
    const p2 = client.sendMessage("second", () => {});
    const close2 = (proc2.on as any).mock.calls.find((c: any) => c[0] === "close")?.[1];
    if (close2) close2(0);
    await p2;

    const [, args2] = mockedSpawn.mock.calls[1];
    expect(args2).toContain("--continue");
  });

  it("passes -f for each image file", async () => {
    const binPath = "C:\\Users\\test\\AppData\\Roaming\\npm\\node_modules\\opencode-ai\\bin\\opencode.exe";
    findBinSpy.mockReturnValue(binPath);

    const proc = makeMockProc();
    mockedSpawn.mockReturnValue(proc);

    const promise = client.sendMessage("hello", () => {}, ["/tmp/a.png", "/tmp/b.png"]);
    const closeHandler = (proc.on as any).mock.calls.find((c: any) => c[0] === "close")?.[1];
    if (closeHandler) closeHandler(0);
    await promise;

    const [, args] = mockedSpawn.mock.calls[0];
    const fIndices = args.map((a, i) => (a === "-f" ? i : -1)).filter((i) => i !== -1);
    expect(fIndices).toHaveLength(2);
    expect(args[fIndices[0] + 1]).toBe("/tmp/a.png");
    expect(args[fIndices[1] + 1]).toBe("/tmp/b.png");
  });

  it("injects XDG_CONFIG_HOME when isolatedConfigDir is set", async () => {
    const binPath = "C:\\Users\\test\\AppData\\Roaming\\npm\\node_modules\\opencode-ai\\bin\\opencode.exe";
    findBinSpy.mockReturnValue(binPath);

    const isolatedClient = new OpenCodeClient(
      "anthropic/claude-3-5-sonnet-20241022",
      "/tmp/test",
      {},
      "/tmp/isolated-config"
    );
    const proc = makeMockProc();
    mockedSpawn.mockReturnValue(proc);

    const promise = isolatedClient.sendMessage("hello", () => {});
    const closeHandler = (proc.on as any).mock.calls.find((c: any) => c[0] === "close")?.[1];
    if (closeHandler) closeHandler(0);
    await promise;

    const [, , opts] = mockedSpawn.mock.calls[0];
    expect(opts?.env?.XDG_CONFIG_HOME).toBe("/tmp/isolated-config");
  });

  it("rejects when spawn errors immediately", async () => {
    const binPath = "C:\\Users\\test\\AppData\\Roaming\\npm\\node_modules\\opencode-ai\\bin\\opencode.exe";
    findBinSpy.mockReturnValue(binPath);

    const proc = makeMockProc();
    mockedSpawn.mockReturnValue(proc);

    const promise = client.sendMessage("hello", () => {});
    const errorHandler = (proc.on as any).mock.calls.find((c: any) => c[0] === "error")?.[1];
    if (errorHandler) errorHandler(new Error("ENOENT"));

    await expect(promise).rejects.toThrow("ENOENT");
  });
});

describe("read-only bash kill-switch", () => {
  it("blocks a genuinely chained command (operator in the command input)", () => {
    expect(detectDisallowedBashCommand("Get-Process; Get-Service")).toMatch(/blocked operator ";"/);
    expect(detectDisallowedBashCommand("cmd1 | cmd2")).toMatch(/blocked operator "\|"/);
    expect(detectDisallowedBashCommand("whoami > out.txt")).toMatch(/blocked operator ">"/);
  });

  it("allows single read-only commands", () => {
    expect(detectDisallowedBashCommand("systeminfo")).toBeNull();
    expect(detectDisallowedBashCommand("Get-CimInstance Win32_OperatingSystem")).toBeNull();
    expect(detectDisallowedBashCommand("git status")).toBeNull();
  });

  it("raw-line scan does NOT false-positive on operators in tool OUTPUT (systeminfo regression)", () => {
    // Real shape: a tool result event line contains "bash", the command, AND
    // an output field whose text contains ";". The whole-line scan used to
    // block this; the fix scans only the command value.
    const resultLine = `{"type":"tool_use","part":{"tool":"bash","state":{"status":"completed","input":{"command":"systeminfo"},"output":"\\r\\nHost Name: SH28052025\\r\\nOS Name: Microsoft Windows; Version 10.0;"}}}`;
    expect(_testDetectDisallowedBashInRawLine(resultLine, true)).toBeNull();
  });

  it("raw-line scan still blocks when the COMMAND itself chains", () => {
    const callLine = `{"type":"tool_use","part":{"tool":"bash","state":{"status":"running","input":{"command":"Get-Process; Get-Service"}}}}`;
    expect(_testDetectDisallowedBashInRawLine(callLine, true)).toMatch(/blocked operator ";"/);
  });

  it("raw-line scan is inert when read-only commands are disabled", () => {
    expect(_testDetectDisallowedBashInRawLine('{"tool":"bash","command":"a; b"}', false)).toBeNull();
  });
});
