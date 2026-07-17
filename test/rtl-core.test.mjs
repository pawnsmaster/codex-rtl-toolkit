import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../src/rtl-core.js", import.meta.url), "utf8");
const context = vm.createContext({});
vm.runInContext(source, context);
const core = context.__CODEX_RTL_CORE__;

test("detects Arabic-script and expanded RTL scripts", () => {
  assert.equal(core.hasRtl("hello سلام"), true);
  assert.equal(core.hasRtl("Hebrew עברית"), true);
  assert.equal(core.hasRtl("Adlam 𞤀𞤣"), true);
  assert.equal(core.hasRtl("plain ASCII 123"), false);
});

test("classifies mixed text without letting a token force a whole block RTL", () => {
  assert.equal(core.classifyText("مرحبا بك"), "rtl");
  assert.equal(core.classifyText("English text with سلام as one example"), "auto");
});

test("isolates arithmetic but not numbers, versions, or currency", () => {
  const values = (text) => core.findMathRanges(text).map(([start, end]) => text.slice(start, end));
  assert.deepEqual(Array.from(values("النتيجة 2 + 3 = 5 صحيحة")), ["2 + 3 = 5"]);
  assert.deepEqual(Array.from(values("الإصدار 1.2.3 والسعر $5.99")), []);
  assert.deepEqual(Array.from(values("المساحة 4 × 5 = 20")), ["4 × 5 = 20"]);
  assert.deepEqual(Array.from(values("for 2 + 3 apples total")), ["2 + 3"]);
});

test("recognizes LaTeX without treating dollars as delimiters", () => {
  assert.equal(core.findLatexRanges("السعر $5.99 فقط").length, 0);
  assert.equal(core.findLatexRanges("القيمة $x^2$ هنا").length, 1);
  assert.equal(core.findLatexRanges("المعادلة \\[E=mc^2\\]").length, 1);
});

test("selects RTL tables from their semantic text", () => {
  const headers = ["الملف", "blob محلي", "النتيجة"].map(core.cellDirection);
  const firstColumn = ["patch.js", "style.css"].map(core.cellDirection);
  assert.equal(core.tableDirection(headers, firstColumn), "rtl");
  assert.equal(core.tableDirection(["Name", "Value", "الاسم"].map(core.cellDirection), []), null);
});
