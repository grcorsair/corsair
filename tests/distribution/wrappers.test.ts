import { describe, test, expect } from "bun:test";
import { existsSync, readFileSync, statSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "..", "..");
const WRAPPERS_DIR = join(ROOT, "scripts", "wrappers");

const WRAPPERS = [
  { name: "prowler-sign.sh", format: "prowler" },
  { name: "inspec-sign.sh", format: "inspec" },
  { name: "trivy-sign.sh", format: "trivy" },
];

describe("Tool wrapper scripts (scripts/wrappers/)", () => {
  describe("wrappers directory", () => {
    test("scripts/wrappers/ directory exists", () => {
      expect(existsSync(WRAPPERS_DIR)).toBe(true);
    });
  });

  for (const wrapper of WRAPPERS) {
    describe(wrapper.name, () => {
      const wrapperPath = join(WRAPPERS_DIR, wrapper.name);

      test("file exists", () => {
        expect(existsSync(wrapperPath)).toBe(true);
      });

      test("is executable", () => {
        const stat = statSync(wrapperPath);
        const isExecutable = (stat.mode & 0o111) !== 0;
        expect(isExecutable).toBe(true);
      });

      test("starts with shebang", () => {
        const content = readFileSync(wrapperPath, "utf-8");
        expect(content.startsWith("#!/")).toBe(true);
      });

      test("uses set -e for fail-fast", () => {
        const content = readFileSync(wrapperPath, "utf-8");
        expect(content).toContain("set -e");
      });

      test(`contains --format ${wrapper.format}`, () => {
        const content = readFileSync(wrapperPath, "utf-8");
        expect(content).toContain(`--format ${wrapper.format}`);
      });

      test("references corsair sign command", () => {
        const content = readFileSync(wrapperPath, "utf-8");
        // Should call corsair.ts sign or corsair sign
        const callsCorsairSign =
          content.includes("corsair.ts sign") ||
          content.includes("corsair sign") ||
          content.includes("${CORSAIR}") ||
          content.includes("$CORSAIR");
        expect(callsCorsairSign).toBe(true);
      });

      test("handles --help or -h flag", () => {
        const content = readFileSync(wrapperPath, "utf-8");
        expect(content).toContain("--help");
        expect(content).toContain("-h");
      });

      test("shows usage text when help is requested", () => {
        const content = readFileSync(wrapperPath, "utf-8");
        // Should contain usage or USAGE string
        const hasUsage =
          content.includes("USAGE") ||
          content.includes("Usage") ||
          content.includes("usage");
        expect(hasUsage).toBe(true);
      });

      test("handles stdin (reads from pipe when no file arg)", () => {
        const content = readFileSync(wrapperPath, "utf-8");
        // Should handle the case of reading from stdin (--file - or piping)
        const handlesStdin =
          content.includes('--file -') ||
          content.includes('--file "-"') ||
          content.includes("stdin") ||
          content.includes("/dev/stdin");
        expect(handlesStdin).toBe(true);
      });

      test("passes through additional arguments", () => {
        const content = readFileSync(wrapperPath, "utf-8");
        // Should pass extra args via $@ or "${@}"
        const passesArgs =
          content.includes('"$@"') ||
          content.includes("$@") ||
          content.includes("${@}");
        expect(passesArgs).toBe(true);
      });
    });
  }

  describe("wrapper help output (runtime)", () => {
    for (const wrapper of WRAPPERS) {
      const wrapperPath = join(WRAPPERS_DIR, wrapper.name);

      test(`${wrapper.name} --help exits with 0 and prints usage`, async () => {
        const proc = Bun.spawn(["bash", wrapperPath, "--help"], {
          stdout: "pipe",
          stderr: "pipe",
        });
        const stdout = await new Response(proc.stdout).text();
        const exitCode = await proc.exited;
        expect(exitCode).toBe(0);
        expect(stdout.length).toBeGreaterThan(0);
        expect(stdout.toLowerCase()).toContain("usage");
      });

      test(`${wrapper.name} -h exits with 0`, async () => {
        const proc = Bun.spawn(["bash", wrapperPath, "-h"], {
          stdout: "pipe",
          stderr: "pipe",
        });
        const exitCode = await proc.exited;
        expect(exitCode).toBe(0);
      });
    }
  });
});
