import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { duplicateKey, parseWorkbook } from "./importValidation";

async function workbookPath(rows: Record<string, string>[]) {
  const file = path.join(os.tmpdir(), `qb-${Date.now()}-${Math.random()}.xlsx`);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Questions");
  const headers = Object.keys(rows[0]);
  sheet.addRow(headers);
  rows.forEach((row) => sheet.addRow(headers.map((header) => row[header])));
  await workbook.xlsx.writeFile(file);
  return file;
}

const validRow = {
  question: "Capital of India?",
  "option A": "Delhi",
  "option B": "Mumbai",
  "option C": "Kolkata",
  "option D": "Chennai",
  "correct answer": "A",
  explanation: "Delhi is the capital.",
  topic: "Geography"
};

describe("import validation", () => {
  it("accepts a valid workbook", async () => {
    const file = await workbookPath([validRow]);
    const result = await parseWorkbook(file);
    fs.unlinkSync(file);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.questions).toHaveLength(1);
      expect(result.questions[0].correctAnswer).toBe("A");
    }
  });

  it("rejects invalid answers and empty required values", async () => {
    const file = await workbookPath([{ ...validRow, question: "", "correct answer": "E" }]);
    const result = await parseWorkbook(file);
    fs.unlinkSync(file);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join("\n")).toContain("questionText is required");
      expect(result.errors.join("\n")).toContain("correct answer must be A, B, C, or D");
    }
  });

  it("rejects missing required columns", async () => {
    const { "option D": _optionD, ...rowWithoutOptionD } = validRow;
    const file = await workbookPath([rowWithoutOptionD]);
    const result = await parseWorkbook(file);
    fs.unlinkSync(file);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join("\n")).toContain("Missing required column: option d");
  });

  it("rejects exact duplicate rows in one file", async () => {
    const file = await workbookPath([validRow, validRow]);
    const result = await parseWorkbook(file);
    fs.unlinkSync(file);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join("\n")).toContain("duplicate question");
  });

  it("normalizes duplicate keys deterministically", () => {
    expect(
      duplicateKey({
        questionText: "  What   is X? ",
        optionA: " A ",
        optionB: "B",
        optionC: "C",
        optionD: "D"
      })
    ).toBe("what is x?|a|b|c|d");
  });
});
