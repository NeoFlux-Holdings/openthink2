/**
 * Smoke tests for the Persona artifact viewers. The tests run under
 * Node without a DOM (matching `vitest.config.ts`), so we exercise the
 * surface area that doesn't need React rendering — module exports,
 * routing helpers, and the CSV / polyline builders.
 */
import { describe, expect, it } from "vitest";
import {
  ArtifactRouter,
  BrowserView,
  ChartView,
  CodeView,
  DocumentView,
  ImageView,
  SlidesView,
  TableView,
  WebpageView,
  buildCsv,
  buildPolylinePoints,
  inferColumns,
  viewKey
} from "../persona-views";
import type {
  PersonaArtifactKind,
  PersonaArtifactWithData,
  TableRow
} from "../persona-views";

describe("persona-views module exports", () => {
  it("exports each view component as a function", () => {
    expect(typeof DocumentView).toBe("function");
    expect(typeof CodeView).toBe("function");
    expect(typeof BrowserView).toBe("function");
    expect(typeof WebpageView).toBe("function");
    expect(typeof SlidesView).toBe("function");
    expect(typeof TableView).toBe("function");
    expect(typeof ImageView).toBe("function");
    expect(typeof ChartView).toBe("function");
  });

  it("exports ArtifactRouter as a function", () => {
    expect(typeof ArtifactRouter).toBe("function");
  });
});

describe("viewKey routes every artifact kind", () => {
  const kinds: PersonaArtifactKind[] = [
    "document",
    "code",
    "browser",
    "webpage",
    "slides",
    "table",
    "image",
    "chart"
  ];

  it("returns a unique key for each kind", () => {
    const keys = kinds.map((k) => viewKey(k));
    expect(new Set(keys).size).toBe(kinds.length);
  });

  it("maps each kind to a stable label", () => {
    expect(viewKey("document")).toBe("document-view");
    expect(viewKey("code")).toBe("code-view");
    expect(viewKey("browser")).toBe("browser-view");
    expect(viewKey("webpage")).toBe("webpage-view");
    expect(viewKey("slides")).toBe("slides-view");
    expect(viewKey("table")).toBe("table-view");
    expect(viewKey("image")).toBe("image-view");
    expect(viewKey("chart")).toBe("chart-view");
  });
});

describe("ArtifactRouter accepts data-augmented artifacts", () => {
  it("accepts a PersonaArtifactWithData<T> through its generic", () => {
    const artifact: PersonaArtifactWithData<{ content: string }> = {
      id: "a1",
      kind: "document",
      title: "Notes",
      version: 1,
      updatedAt: new Date().toISOString(),
      data: { content: "hello" }
    };
    expect(artifact.kind).toBe("document");
    expect(artifact.data?.content).toBe("hello");
  });
});

describe("buildCsv", () => {
  it("emits a header row when there are no data rows", () => {
    expect(buildCsv(["a", "b"], [])).toBe("a,b");
  });

  it("emits header + body for typical rows", () => {
    const rows: TableRow[] = [
      { name: "Ada", age: 36 },
      { name: "Linus", age: 54 }
    ];
    expect(buildCsv(["name", "age"], rows)).toBe("name,age\nAda,36\nLinus,54");
  });

  it("quotes cells containing commas, quotes, or newlines", () => {
    const rows: TableRow[] = [
      { text: "hello, world" },
      { text: 'with "quotes"' },
      { text: "line\nbreak" }
    ];
    const csv = buildCsv(["text"], rows);
    expect(csv).toBe('text\n"hello, world"\n"with ""quotes"""\n"line\nbreak"');
  });

  it("handles missing columns as empty strings", () => {
    const rows: TableRow[] = [{ a: 1 }];
    expect(buildCsv(["a", "b"], rows)).toBe("a,b\n1,");
  });
});

describe("inferColumns", () => {
  it("returns column union across all rows", () => {
    const rows: TableRow[] = [{ a: 1 }, { b: 2 }, { a: 3, c: 4 }];
    expect(inferColumns(rows).sort()).toEqual(["a", "b", "c"]);
  });
});

describe("buildPolylinePoints", () => {
  it("returns an empty string when there are no points", () => {
    expect(buildPolylinePoints([])).toBe("");
  });

  it("maps the first and last points to the inner edges of the box", () => {
    const out = buildPolylinePoints(
      [
        { x: 0, y: 0 },
        { x: 10, y: 10 }
      ],
      100,
      100,
      10
    );
    const pairs = out.split(" ");
    expect(pairs).toHaveLength(2);
    expect(pairs[0]).toBe("10.00,90.00");
    expect(pairs[1]).toBe("90.00,10.00");
  });
});
