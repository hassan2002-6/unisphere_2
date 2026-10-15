import { describe, expect, it } from "vitest";
import { IMPORT_COLUMNS, parseCsv, templateCsv } from "@/server/services/import-admin";

describe("parseCsv()", () => {
  it("parses a plain header + rows", () => {
    const rows = parseCsv("name,email\nAyesha Khan,a@shu.edu.pk\nBilal Ahmed,b@shu.edu.pk");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual(["name", "email"]);
    expect(rows[1]).toEqual(["Ayesha Khan", "a@shu.edu.pk"]);
  });

  it("handles quoted fields with commas and escaped quotes", () => {
    const rows = parseCsv('name,note\n"Khan, Ayesha","He said ""hello"""');
    expect(rows[1]).toEqual(["Khan, Ayesha", 'He said "hello"']);
  });

  it("handles CRLF line endings and a UTF-8 BOM", () => {
    const rows = parseCsv("\uFEFFname,email\r\nA,b@x.pk\r\n");
    expect(rows[0]).toEqual(["name", "email"]);
    expect(rows[1]).toEqual(["A", "b@x.pk"]);
  });

  it("skips blank lines but keeps empty trailing fields", () => {
    const rows = parseCsv("a,b\n\n1,\n\n2,3");
    expect(rows.map((r) => r.join("|"))).toEqual(["a|b", "1|", "2|3"]);
  });

  it("returns one row for a single header line", () => {
    expect(parseCsv("name,email")).toEqual([["name", "email"]]);
  });
});

describe("templateCsv()", () => {
  it("emits the exact column order used by the importer", () => {
    for (const entity of Object.keys(IMPORT_COLUMNS) as (keyof typeof IMPORT_COLUMNS)[]) {
      const [header] = parseCsv(templateCsv(entity));
      expect(header).toEqual(IMPORT_COLUMNS[entity]);
    }
  });

  it("ships at least one sample row per entity", () => {
    for (const entity of Object.keys(IMPORT_COLUMNS) as (keyof typeof IMPORT_COLUMNS)[]) {
      const rows = parseCsv(templateCsv(entity));
      expect(rows.length).toBeGreaterThan(1);
      expect(rows[1][0].length).toBeGreaterThan(0);
    }
  });
});
