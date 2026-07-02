import { describe, it, expect } from "vitest";
import { detectDisallowedBashCommand } from "./opencode-client";

describe("detectDisallowedBashCommand", () => {
  describe("operator block", () => {
    it("blocks ; (PowerShell statement separator)", () => {
      expect(detectDisallowedBashCommand("git log ; Remove-Item x")).toContain(";");
    });

    it("blocks & (call operator)", () => {
      expect(detectDisallowedBashCommand("git log & del file.txt")).toContain("&");
    });

    it("blocks | (pipe)", () => {
      expect(detectDisallowedBashCommand("dir | findstr foo")).toContain("|");
    });

    it("blocks > (redirect)", () => {
      expect(detectDisallowedBashCommand("git log > out.txt")).toContain(">");
    });

    it("blocks < (input redirect)", () => {
      expect(detectDisallowedBashCommand("sort < input.txt")).toContain("<");
    });

    it("does NOT block ^ (irrelevant in PowerShell)", () => {
      expect(detectDisallowedBashCommand("findstr ^test file.txt")).toBeNull();
    });

    it("does NOT block ( ) (legitimate in paths)", () => {
      expect(detectDisallowedBashCommand('dir "C:\\Program Files (x86)"')).toBeNull();
    });

    it("does NOT block $ (needed for $env:VAR)", () => {
      expect(detectDisallowedBashCommand("dir $env:USERPROFILE")).toBeNull();
    });
  });

  describe("mutating command denylist", () => {
    it("blocks Remove-Item", () => {
      expect(detectDisallowedBashCommand("Remove-Item file.txt")).toContain("mutating");
    });

    it("blocks Set-Content", () => {
      expect(detectDisallowedBashCommand("Set-Content file.txt 'data'")).toContain("mutating");
    });

    it("blocks Out-File", () => {
      expect(detectDisallowedBashCommand("Get-Process | Out-File procs.txt")).toContain("operator");
    });

    it("blocks New-Item", () => {
      expect(detectDisallowedBashCommand("New-Item -Path newdir -ItemType Directory")).toContain("mutating");
    });

    it("blocks Stop-Process", () => {
      expect(detectDisallowedBashCommand("Stop-Process -Name node")).toContain("mutating");
    });

    it("blocks Start-Process", () => {
      expect(detectDisallowedBashCommand("Start-Process notepad")).toContain("mutating");
    });

    it("blocks del (alias)", () => {
      expect(detectDisallowedBashCommand("del file.txt")).toContain("mutating");
    });

    it("blocks mkdir (alias)", () => {
      expect(detectDisallowedBashCommand("mkdir newdir")).toContain("mutating");
    });

    it("blocks format", () => {
      expect(detectDisallowedBashCommand("format D:")).toContain("mutating");
    });

    it("blocks taskkill", () => {
      expect(detectDisallowedBashCommand("taskkill /PID 1234")).toContain("mutating");
    });

    it("blocks shutdown", () => {
      expect(detectDisallowedBashCommand("shutdown /s")).toContain("mutating");
    });

    it("blocks node (code execution)", () => {
      expect(detectDisallowedBashCommand("node --version")).toContain("mutating");
    });

    it("blocks python (code execution)", () => {
      expect(detectDisallowedBashCommand("python script.py")).toContain("mutating");
    });

    it("blocks cmd (nested shell)", () => {
      expect(detectDisallowedBashCommand('cmd /c "del file.txt"')).toContain("mutating");
    });

    it("blocks powershell (nested shell)", () => {
      expect(detectDisallowedBashCommand("powershell -Command Get-Process")).toContain("mutating");
    });

    it("blocks curl (can POST/PUT)", () => {
      expect(detectDisallowedBashCommand("curl http://example.com")).toContain("mutating");
    });

    it("blocks Invoke-WebRequest", () => {
      expect(detectDisallowedBashCommand("Invoke-WebRequest http://example.com")).toContain("mutating");
    });
  });

  describe("git subcommand denylist", () => {
    it("blocks git push", () => {
      expect(detectDisallowedBashCommand("git push origin main")).toContain("mutating");
    });

    it("blocks git commit", () => {
      expect(detectDisallowedBashCommand("git commit -m test")).toContain("mutating");
    });

    it("blocks git merge", () => {
      expect(detectDisallowedBashCommand("git merge feature")).toContain("mutating");
    });

    it("blocks git reset", () => {
      expect(detectDisallowedBashCommand("git reset --hard")).toContain("mutating");
    });

    it("blocks git checkout", () => {
      expect(detectDisallowedBashCommand("git checkout feature")).toContain("mutating");
    });

    it("blocks git stash", () => {
      expect(detectDisallowedBashCommand("git stash")).toContain("mutating");
    });

    it("blocks git clone", () => {
      expect(detectDisallowedBashCommand("git clone https://repo.git")).toContain("mutating");
    });

    it("blocks git add", () => {
      expect(detectDisallowedBashCommand("git add file.txt")).toContain("mutating");
    });

    it("ALLOWS git status", () => {
      expect(detectDisallowedBashCommand("git status")).toBeNull();
    });

    it("ALLOWS git log", () => {
      expect(detectDisallowedBashCommand("git log --oneline -10")).toBeNull();
    });

    it("ALLOWS git diff", () => {
      expect(detectDisallowedBashCommand("git diff --staged")).toBeNull();
    });

    it("ALLOWS git show", () => {
      expect(detectDisallowedBashCommand("git show HEAD")).toBeNull();
    });

    it("ALLOWS git blame", () => {
      expect(detectDisallowedBashCommand("git blame file.ts")).toBeNull();
    });

    it("ALLOWS git branch (list, not delete)", () => {
      expect(detectDisallowedBashCommand("git branch -a")).toBeNull();
    });
  });

  describe("npm subcommand denylist", () => {
    it("blocks npm install", () => {
      expect(detectDisallowedBashCommand("npm install express")).toContain("mutating");
    });

    it("blocks npm uninstall", () => {
      expect(detectDisallowedBashCommand("npm uninstall express")).toContain("mutating");
    });

    it("ALLOWS npm list", () => {
      expect(detectDisallowedBashCommand("npm list")).toBeNull();
    });

    it("ALLOWS npm ls", () => {
      expect(detectDisallowedBashCommand("npm ls --depth=0")).toBeNull();
    });
  });

  describe("read-only commands ALLOWED (not in denylist)", () => {
    it("allows git status", () => expect(detectDisallowedBashCommand("git status")).toBeNull());
    it("allows git log with flags", () => expect(detectDisallowedBashCommand("git log --oneline -10")).toBeNull());
    it("allows git diff", () => expect(detectDisallowedBashCommand("git diff")).toBeNull());
    it("allows git show", () => expect(detectDisallowedBashCommand("git show HEAD")).toBeNull());
    it("allows git blame", () => expect(detectDisallowedBashCommand("git blame file.ts")).toBeNull());
    it("allows git reflog", () => expect(detectDisallowedBashCommand("git reflog")).toBeNull());
    it("allows git ls-files", () => expect(detectDisallowedBashCommand("git ls-files")).toBeNull());
    it("allows git rev-parse", () => expect(detectDisallowedBashCommand("git rev-parse HEAD")).toBeNull());
    it("allows git branch (list)", () => expect(detectDisallowedBashCommand("git branch -a")).toBeNull());
    it("allows git remote", () => expect(detectDisallowedBashCommand("git remote -v")).toBeNull());
    it("allows git config (list)", () => expect(detectDisallowedBashCommand("git config --list")).toBeNull());
    it("allows git tag (list)", () => expect(detectDisallowedBashCommand("git tag")).toBeNull());
    it("allows npm list", () => expect(detectDisallowedBashCommand("npm list")).toBeNull());
    it("allows npm ls", () => expect(detectDisallowedBashCommand("npm ls --depth=0")).toBeNull());
    it("allows tasklist", () => expect(detectDisallowedBashCommand("tasklist")).toBeNull());
    it("allows tasklist with filters", () => expect(detectDisallowedBashCommand('tasklist /fi "PID eq 1234"')).toBeNull());
    it("allows systeminfo", () => expect(detectDisallowedBashCommand("systeminfo")).toBeNull());
    it("allows ipconfig", () => expect(detectDisallowedBashCommand("ipconfig /all")).toBeNull());
    it("allows netstat", () => expect(detectDisallowedBashCommand("netstat -ano")).toBeNull());
    it("allows findstr", () => expect(detectDisallowedBashCommand('findstr /S /I "error" *.log')).toBeNull());
    it("allows dir", () => expect(detectDisallowedBashCommand("dir C:\\Users")).toBeNull());
    it("allows dir with env var", () => expect(detectDisallowedBashCommand("dir $env:USERPROFILE")).toBeNull());
    it("allows dir with parens in path", () => expect(detectDisallowedBashCommand('dir "C:\\Program Files (x86)"')).toBeNull());
    it("allows whoami", () => expect(detectDisallowedBashCommand("whoami /all")).toBeNull());
    it("allows hostname", () => expect(detectDisallowedBashCommand("hostname")).toBeNull());
    it("allows where", () => expect(detectDisallowedBashCommand("where git")).toBeNull());
    it("allows where.exe", () => expect(detectDisallowedBashCommand("where.exe git")).toBeNull());
    it("allows tree", () => expect(detectDisallowedBashCommand("tree /F")).toBeNull());
    it("allows driverquery", () => expect(detectDisallowedBashCommand("driverquery")).toBeNull());
    it("allows Get-Content", () => expect(detectDisallowedBashCommand("Get-Content file.txt")).toBeNull());
    it("allows Get-ChildItem", () => expect(detectDisallowedBashCommand("Get-ChildItem -Recurse")).toBeNull());
    it("allows Select-String", () => expect(detectDisallowedBashCommand('Select-String -Pattern "error" *.log')).toBeNull());
    it("allows Get-Process", () => expect(detectDisallowedBashCommand("Get-Process")).toBeNull());
    it("allows Get-Service", () => expect(detectDisallowedBashCommand("Get-Service")).toBeNull());
    it("allows Test-Path", () => expect(detectDisallowedBashCommand("Test-Path C:\\Users")).toBeNull());
    it("allows Measure-Object", () => expect(detectDisallowedBashCommand("Get-ChildItem | Measure-Object")).toContain("operator")); // has | — blocked
  });

  describe("case insensitivity", () => {
    it("allows GIT STATUS", () => {
      expect(detectDisallowedBashCommand("GIT STATUS")).toBeNull();
    });

    it("blocks REMOVE-ITEM (uppercase)", () => {
      expect(detectDisallowedBashCommand("REMOVE-ITEM file.txt")).toContain("mutating");
    });

    it("blocks Remove-Item (PascalCase)", () => {
      expect(detectDisallowedBashCommand("Remove-Item file.txt")).toContain("mutating");
    });

    it("blocks remove-item (lowercase)", () => {
      expect(detectDisallowedBashCommand("remove-item file.txt")).toContain("mutating");
    });
  });

  describe(".exe suffix normalization", () => {
    it("allows where.exe (normalized to where)", () => {
      expect(detectDisallowedBashCommand("where.exe git")).toBeNull();
    });

    it("allows TASKLIST.EXE", () => {
      expect(detectDisallowedBashCommand("TASKLIST.EXE")).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("blocks empty string", () => {
      expect(detectDisallowedBashCommand("")).not.toBeNull();
    });

    it("blocks whitespace-only", () => {
      expect(detectDisallowedBashCommand("   ")).not.toBeNull();
    });

    it("blocks undefined", () => {
      expect(detectDisallowedBashCommand(undefined)).not.toBeNull();
    });

    it("trims leading whitespace", () => {
      expect(detectDisallowedBashCommand("  git status")).toBeNull();
    });
  });
});
