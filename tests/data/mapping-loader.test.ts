/**
 * MappingLoader Tests
 *
 * Validates CTID/SCF data loading, technique lookups, and framework coverage.
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { MappingLoader } from "../../src/data/mapping-loader";
import type { MappingDatabase } from "../../src/data/mapping-loader";
import { join } from "path";

describe("MappingLoader - Data Layer", () => {
  let db: MappingDatabase;

  beforeAll(async () => {
    MappingLoader.reset();
    db = await MappingLoader.load(join(__dirname, "../../src/data"));
  });

  afterAll(() => {
    MappingLoader.reset();
  });

  test("loads CTID and SCF data successfully", () => {
    expect(db).toBeDefined();
    expect(db.mitreToNist.size).toBeGreaterThan(0);
    expect(db.nistToFrameworks.size).toBeGreaterThan(0);
    expect(db.mitreToFrameworks.size).toBeGreaterThan(0);
  });

  test("CTID maps T1556 to NIST 800-53 controls", () => {
    const t1556 = db.mitreToNist.get("T1556");
    expect(t1556).toBeDefined();
    expect(t1556!.name).toBe("Modify Authentication Process");
    expect(t1556!.controls).toContain("IA-2");
    expect(t1556!.controls.length).toBeGreaterThan(0);
  });

  test("CTID maps T1110 to NIST 800-53 controls", () => {
    const t1110 = db.mitreToNist.get("T1110");
    expect(t1110).toBeDefined();
    expect(t1110!.name).toBe("Brute Force");
    expect(t1110!.controls).toContain("AC-7");
  });

  test("CTID maps T1078 to NIST 800-53 controls", () => {
    const t1078 = db.mitreToNist.get("T1078");
    expect(t1078).toBeDefined();
    expect(t1078!.name).toBe("Valid Accounts");
    expect(t1078!.controls).toContain("AC-2");
  });

  test("SCF maps IA-2 to multiple frameworks", () => {
    const ia2 = db.nistToFrameworks.get("IA-2");
    expect(ia2).toBeDefined();
    expect(ia2!.name).toBe("Identification and Authentication (Organizational Users)");
    expect(ia2!.frameworks["NIST-CSF"]).toBeDefined();
    expect(ia2!.frameworks["SOC2"]).toBeDefined();
    expect(ia2!.frameworks["ISO27001"]).toBeDefined();
    expect(ia2!.frameworks["CIS"]).toBeDefined();
    expect(ia2!.frameworks["PCI-DSS"]).toBeDefined();
  });

  test("pre-computed MITRE → frameworks resolves T1556", () => {
    const frameworks = MappingLoader.lookupMitre(db, "T1556");
    expect(frameworks).toBeDefined();
    expect(frameworks["NIST-800-53"]).toBeDefined();
    expect(frameworks["NIST-800-53"]!.length).toBeGreaterThan(0);
    expect(frameworks["NIST-CSF"]).toBeDefined();
    expect(frameworks["SOC2"]).toBeDefined();
  });

  test("lookupNist80053 finds techniques for AC-2", () => {
    const techniques = MappingLoader.lookupNist80053(db, "AC-2");
    expect(techniques.length).toBeGreaterThan(0);
    expect(techniques).toContain("T1078");
    expect(techniques).toContain("T1556");
  });

  test("getCoverageStats returns framework counts", () => {
    const stats = MappingLoader.getCoverageStats(db);
    expect(stats["NIST-800-53"]).toBeGreaterThan(0);
    expect(stats["NIST-CSF"]).toBeGreaterThan(0);
    expect(stats["SOC2"]).toBeGreaterThan(0);
  });

  test("supported frameworks list includes core frameworks", () => {
    expect(db.supportedFrameworks).toContain("NIST-800-53");
    expect(db.supportedFrameworks).toContain("NIST-CSF");
    expect(db.supportedFrameworks).toContain("SOC2");
    expect(db.supportedFrameworks).toContain("ISO27001");
    expect(db.supportedFrameworks).toContain("CIS");
    expect(db.supportedFrameworks).toContain("PCI-DSS");
  });

  test("returns empty for unknown technique", () => {
    const frameworks = MappingLoader.lookupMitre(db, "T9999.999");
    expect(Object.keys(frameworks).length).toBe(0);
  });

  test("caches on repeated load calls", async () => {
    const db2 = await MappingLoader.load();
    expect(db2).toBe(db); // Same reference (cached)
  });
});
