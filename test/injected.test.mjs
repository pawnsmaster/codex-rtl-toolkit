import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { JSDOM } from "jsdom";

const core = readFileSync(new URL("../src/rtl-core.js", import.meta.url), "utf8");
const injected = readFileSync(new URL("../src/injected.js", import.meta.url), "utf8");

function run(html) {
  const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
  dom.window.__CODEX_RTL_STYLE__ = "[dir=rtl] { direction: rtl; }";
  dom.window.eval(core);
  dom.window.eval(injected);
  return dom.window.document;
}

test("directs messages while leaving unrelated application chrome alone", () => {
  const document = run(`
    <body>
      <aside><div id="sidebar">محادثة عربية</div></aside>
      <main><article data-message-author-role="assistant"><p id="message">مرحبا بالعالم</p></article></main>
    </body>`);
  assert.equal(document.querySelector("#message").dir, "rtl");
  assert.equal(document.querySelector("#sidebar").hasAttribute("dir"), false);
});

test("isolates arithmetic and keeps code LTR", () => {
  const document = run(`
    <body><main>
      <p id="message">النتيجة 2 + 3 = 5 صحيحة</p>
      <pre><code id="code">const رسالة = "مرحبا";</code></pre>
    </main></body>`);
  assert.equal(document.querySelector("#message [data-codex-math-run]").textContent, "2 + 3 = 5");
  assert.equal(document.querySelector("#code").dir, "ltr");
});

test("keeps a LaTeX island intact instead of nesting Latin-run wrappers", () => {
  const document = run("<body><main><p id='message'>القيمة $x^2$ هنا</p></main></body>");
  const math = document.querySelector("#message [data-codex-math-run]");
  assert.equal(math.textContent, "$x^2$");
  assert.equal(math.querySelector("[data-codex-ltr-run]"), null);
});

test("directs RTL tables without changing English tables", () => {
  const document = run(`
    <body><main>
      <table id="rtl"><thead><tr><th>الملف</th><th>النتيجة</th></tr></thead><tbody><tr><td>ملف</td><td>صحيح</td></tr></tbody></table>
      <table id="ltr"><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody><tr><td>One</td><td>1</td></tr></tbody></table>
    </main></body>`);
  assert.equal(document.querySelector("#rtl").dataset.codexRtlTable, "true");
  assert.equal(document.querySelector("#ltr").hasAttribute("dir"), false);
});

test("preserves per-line Markdown editor direction", () => {
  const document = run(`
    <body><main><div class="cm-content" data-language="markdown">
      <div class="cm-line" id="arabic">سطر عربي</div>
      <div class="cm-line" id="english">English line</div>
    </div></main></body>`);
  assert.equal(document.querySelector("#arabic").dir, "rtl");
  assert.equal(document.querySelector("#english").dir, "ltr");
});
