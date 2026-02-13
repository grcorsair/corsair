import { describe, test, expect } from "bun:test";
import { existsSync, readFileSync, statSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "..", "..");
const INSTALL_SCRIPT_PATH = join(ROOT, "scripts", "install.sh");

describe("Install script (scripts/install.sh)", () => {
  test("install.sh exists", () => {
    expect(existsSync(INSTALL_SCRIPT_PATH)).toBe(true);
  });

  test("is executable (has execute permission)", () => {
    const stat = statSync(INSTALL_SCRIPT_PATH);
    // Check owner execute bit (0o100)
    const isExecutable = (stat.mode & 0o111) !== 0;
    expect(isExecutable).toBe(true);
  });

  describe("content", () => {
    function getContent(): string {
      return readFileSync(INSTALL_SCRIPT_PATH, "utf-8");
    }

    test("starts with shebang", () => {
      const content = getContent();
      expect(content.startsWith("#!/")).toBe(true);
    });

    test("uses set -e for fail-fast", () => {
      const content = getContent();
      expect(content).toContain("set -e");
    });

    test("detects operating system", () => {
      const content = getContent();
      // Should use uname or $OSTYPE to detect OS
      const detectsOS = content.includes("uname") || content.includes("OSTYPE");
      expect(detectsOS).toBe(true);
    });

    test("checks for or installs bun", () => {
      const content = getContent();
      // Should reference bun installation
      expect(content).toContain("bun");
      // Should check if bun exists or install it
      const checksBun =
        content.includes("command -v bun") ||
        content.includes("which bun") ||
        content.includes("type bun");
      expect(checksBun).toBe(true);
    });

    test("clones the corsair repository", () => {
      const content = getContent();
      expect(content).toContain("git clone");
      expect(content).toContain("corsair");
    });

    test("runs bun install", () => {
      const content = getContent();
      expect(content).toContain("bun install");
    });

    test("prints next steps (keygen and sign --help)", () => {
      const content = getContent();
      // Script references corsair.ts keygen and corsair.ts sign
      expect(content).toContain("corsair.ts keygen");
      expect(content).toContain("corsair.ts sign");
    });
  });
});
