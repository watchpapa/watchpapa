import { describe, it, expect } from "vitest";
import { escapeCsvField, toCsv } from "../src/lib/csv.js";

describe("csv", () => {
  it("quotes fields with commas, quotes, newlines", () => {
    expect(escapeCsvField("plain")).toBe("plain");
    expect(escapeCsvField("a,b")).toBe('"a,b"');
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvField(null)).toBe("");
  });
  it("builds a header + rows document", () => {
    expect(toCsv(["a", "b"], [[1, "x,y"], [2, "z"]])).toBe('a,b\n1,"x,y"\n2,z');
  });
});
