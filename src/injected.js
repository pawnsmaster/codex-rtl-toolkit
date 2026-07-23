(function codexRtlToolkit() {
  const STYLE_ID = "codex-rtl-toolkit-style";
  const core = globalThis.__CODEX_RTL_CORE__;
  if (!core) throw new Error("Codex RTL core was not loaded.");
  const ARABIC_SCRIPT_RE = core.RTL_CHAR_RE;
  const LATIN_RE = /[A-Za-z]/;
  const processed = new WeakMap();
  const pending = new Set();
  let scheduled = false;
  const BLOCK_SELECTOR = [
    "article",
    "[data-message-author-role]",
    "[data-testid*='message']",
    "[class*='message' i]",
    "[class*='markdown' i]",
    "[class*='whitespace-pre-wrap' i]",
    "main p",
    "main li",
    "main blockquote"
  ].join(",");
  const TEXT_LEAF_SELECTOR = [
    "[data-message-author-role='user' i] div",
    "[data-message-author-role='user' i] span",
    "[data-message-author-role='user' i] p",
    "[data-testid*='message' i] div",
    "[data-testid*='message' i] span",
    "[class*='whitespace-pre-wrap' i]",
    "[class*='break-words' i]",
    "[class*='text-message' i]"
  ].join(",");
  const INTERACTIVE_SELECTOR = [
    "textarea",
    "input",
    "[contenteditable='true']",
    "[role='textbox']",
    "form",
    "[data-testid*='composer' i]",
    "[class*='composer' i]",
    "[class*='prompt' i]"
  ].join(",");
  const CODE_BLOCK_SELECTOR = [
    "pre",
    "code",
    "kbd",
    "samp",
    "[data-testid*='code' i]",
    "[class*='code' i]",
    "[class*='highlight' i]",
    "[class*='shiki' i]",
    "[class*='terminal' i]",
    "[class*='monaco' i]"
  ].join(",");
  const MARKDOWN_EDITOR_SELECTOR = ".cm-content[data-language='markdown']";

  function ensureStyle() {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      document.documentElement.appendChild(style);
    }
    style.textContent = window.__CODEX_RTL_STYLE__ || "";
    document.documentElement.dataset.codexRtlRoot = "true";
  }

  function isCodeLike(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
    return Boolean(node.closest(`${CODE_BLOCK_SELECTOR}, textarea, input, [role='textbox']`));
  }

  function isInteractive(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
    return Boolean(node.closest(INTERACTIVE_SELECTOR));
  }

  function isMarkdownEditor(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
    return Boolean(
      node.matches?.(MARKDOWN_EDITOR_SELECTOR)
      || node.closest?.(MARKDOWN_EDITOR_SELECTOR)
      || node.querySelector?.(MARKDOWN_EDITOR_SELECTOR)
    );
  }

  function classifyText(text) {
    return core.classifyText(text);
  }

  function applyDirection(el) {
    if (!el || isCodeLike(el) || isInteractive(el)) return;
    const text = (el.innerText || el.textContent || "").trim();
    if (!text) return;
    if (processed.get(el) === text) return;
    processed.set(el, text);

    const direction = classifyText(text);
    if (direction === "rtl") {
      el.dataset.codexRtl = "true";
      el.dir = "rtl";
    } else if (ARABIC_SCRIPT_RE.test(text) && LATIN_RE.test(text)) {
      el.dataset.codexBidi = "auto";
      if (!el.getAttribute("dir")) el.dir = "auto";
    }
  }

  function codeLanguage(code) {
    const classNames = [
      code.getAttribute("class") || "",
      code.closest("pre")?.getAttribute("class") || ""
    ].join(" ");
    const classMatch = classNames.match(/(?:language|lang)-([a-z0-9_-]+)/i);
    if (classMatch?.[1]) return classMatch[1].toLowerCase();

    const codeBlock = code.closest("[class*='codeBlock' i], [data-testid*='code' i]");
    const headerLabel = codeBlock?.firstElementChild?.firstElementChild?.textContent?.trim();
    if (/^[a-z0-9_-]{1,24}$/i.test(headerLabel || "")) return headerLabel.toLowerCase();

    const firstLine = (code.textContent || "").trimStart().split(/\r?\n/, 1)[0]?.trim();
    return /^[a-z0-9_-]{1,24}$/i.test(firstLine || "") ? firstLine.toLowerCase() : "";
  }

  function applyProseCodeDirection(code) {
    const language = codeLanguage(code);
    const pre = code.closest("pre");
    const isText = ["text", "txt", "plain", "plaintext"].includes(language);
    const isMarkdown = ["md", "markdown"].includes(language)
      || (!language && Boolean(code.querySelector(".hljs-bullet, .hljs-section, .hljs-strong, .hljs-emphasis")));

    delete code.dataset.codexTextBlock;
    delete pre?.dataset.codexTextBlock;
    if (!isText && !isMarkdown) return;

    const lineContainer = code.firstElementChild;
    if (!lineContainer?.children.length) return;

    code.dataset.codexProseCode = "true";
    code.dir = "ltr";

    for (const line of lineContainer.children) {
      const direction = ARABIC_SCRIPT_RE.test(line.textContent || "") ? "rtl" : "ltr";
      line.dir = direction;
      line.dataset.codexProseDirection = direction;
      delete line.dataset.codexMarkdownRtl;

      for (const token of line.querySelectorAll("*")) {
        if (direction === "rtl" && ARABIC_SCRIPT_RE.test(token.textContent || "")) {
          token.dir = "rtl";
          token.dataset.codexProseTokenRtl = "true";
        } else if (token.dataset.codexProseTokenRtl === "true" || token.dataset.codexMarkdownTokenRtl === "true") {
          delete token.dataset.codexProseTokenRtl;
          delete token.dataset.codexMarkdownTokenRtl;
          if (token.getAttribute("dir") === "rtl") token.removeAttribute("dir");
        }
      }
    }
  }

  function hasDirectText(el) {
    return Array.from(el.childNodes).some((node) => (
      node.nodeType === Node.TEXT_NODE && ARABIC_SCRIPT_RE.test(node.textContent || "")
    ));
  }

  function applyTextLeafDirection(el) {
    if (!el || isCodeLike(el) || isInteractive(el) || !hasDirectText(el)) return;
    applyDirection(el);
  }

  function isolateLatinRuns(el) {
    if (!el?.dataset.codexRtl || isCodeLike(el) || isInteractive(el)) return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    let node;

    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent || parent.closest(`${CODE_BLOCK_SELECTOR}, [data-codex-ltr-run], [data-codex-math-run], ${INTERACTIVE_SELECTOR}`)) continue;
      if (LATIN_RE.test(node.textContent || "")) textNodes.push(node);
    }

    const latinRun = /[A-Za-z][A-Za-z0-9._:/\\+@#-]*(?:\s+[A-Za-z][A-Za-z0-9._:/\\+@#-]*)*/g;
    for (const textNode of textNodes) {
      const text = textNode.textContent || "";
      const matches = Array.from(text.matchAll(latinRun));
      if (matches.length === 0) continue;

      const fragment = document.createDocumentFragment();
      let offset = 0;
      for (const match of matches) {
        const index = match.index || 0;
        fragment.append(text.slice(offset, index));
        const trailingPunctuation = match[0].match(/[.,;:!?]+$/)?.[0] || "";
        const latinText = trailingPunctuation
          ? match[0].slice(0, -trailingPunctuation.length)
          : match[0];
        const bdi = document.createElement("bdi");
        bdi.dir = "ltr";
        bdi.dataset.codexLtrRun = "true";
        bdi.textContent = latinText;
        fragment.append(bdi);
        fragment.append(trailingPunctuation);
        offset = index + match[0].length;
      }
      fragment.append(text.slice(offset));
      textNode.replaceWith(fragment);
    }
  }

  function isolateMathRuns(el) {
    if (!el?.dataset.codexRtl || isCodeLike(el) || isInteractive(el)) return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent || parent.closest("[data-codex-math-run], [data-codex-ltr-run], pre, code")) continue;
      if (core.segmentText(node.textContent || "").some((segment) => segment.type === "math")) textNodes.push(node);
    }

    for (const textNode of textNodes) {
      const segments = core.segmentText(textNode.textContent || "");
      const fragment = document.createDocumentFragment();
      for (const segment of segments) {
        if (segment.type === "text") {
          fragment.append(segment.value);
        } else {
          const bdi = document.createElement("bdi");
          bdi.dir = "ltr";
          bdi.dataset.codexMathRun = "true";
          bdi.textContent = segment.value;
          fragment.append(bdi);
        }
      }
      textNode.replaceWith(fragment);
    }
  }

  function applyTableDirection(table) {
    if (!table || table.closest(`${CODE_BLOCK_SELECTOR}, ${INTERACTIVE_SELECTOR}`)) return;
    const headers = Array.from(table.querySelectorAll("thead th"));
    const rows = Array.from(table.querySelectorAll("tbody tr"));
    const headerDirections = headers.map((cell) => core.cellDirection(cell.textContent || ""));
    const firstColumnDirections = rows
      .map((row) => row.querySelector("th, td"))
      .filter(Boolean)
      .map((cell) => core.cellDirection(cell.textContent || ""));
    if (core.tableDirection(headerDirections, firstColumnDirections) === "rtl") {
      table.dir = "rtl";
      table.dataset.codexRtlTable = "true";
    } else if (table.dataset.codexRtlTable === "true") {
      delete table.dataset.codexRtlTable;
      table.removeAttribute("dir");
    }
  }

  function applyMarkdownEditorLineDirection(line) {
    const text = (line.innerText || line.textContent || "").trim();
    const direction = ARABIC_SCRIPT_RE.test(text) ? "rtl" : "ltr";
    if (
      processed.get(line) === text
      && line.dataset.codexMarkdownEditorDirection === direction
      && line.getAttribute("dir") === direction
    ) return;

    processed.set(line, text);
    line.dataset.codexMarkdownEditorDirection = direction;
    line.dir = direction;
  }

  function applyMarkdownEditorDirection(root) {
    const containingEditor = root.closest?.(MARKDOWN_EDITOR_SELECTOR);
    if (containingEditor) {
      containingEditor.dataset.codexMarkdownEditor = "true";
      const line = root.matches?.(".cm-line") ? root : root.closest?.(".cm-line");
      if (line && line.parentElement === containingEditor) {
        applyMarkdownEditorLineDirection(line);
      } else {
        containingEditor.querySelectorAll(":scope > .cm-line").forEach(applyMarkdownEditorLineDirection);
      }
      return;
    }

    const editors = [];
    if (root.matches?.(MARKDOWN_EDITOR_SELECTOR)) editors.push(root);
    root.querySelectorAll?.(MARKDOWN_EDITOR_SELECTOR).forEach((editor) => editors.push(editor));

    for (const editor of editors) {
      editor.dataset.codexMarkdownEditor = "true";
      editor.querySelectorAll(":scope > .cm-line").forEach(applyMarkdownEditorLineDirection);
    }
  }

  function scan(root) {
    if (!root || root.nodeType !== Node.ELEMENT_NODE) return;
    applyMarkdownEditorDirection(root);
    if (isInteractive(root) && !isMarkdownEditor(root)) return;
    root.querySelectorAll?.(CODE_BLOCK_SELECTOR).forEach((el) => {
      el.dir = "ltr";
      el.dataset.codexCodeLtr = "true";
    });
    if (root.matches && root.matches("code")) applyProseCodeDirection(root);
    root.querySelectorAll?.("code").forEach(applyProseCodeDirection);
    if (root.matches?.("table")) applyTableDirection(root);
    root.querySelectorAll?.("table").forEach(applyTableDirection);
    if (root.matches && root.matches(BLOCK_SELECTOR)) applyDirection(root);
    root.querySelectorAll?.(BLOCK_SELECTOR).forEach(applyDirection);
    if (root.matches && root.matches(TEXT_LEAF_SELECTOR)) applyTextLeafDirection(root);
    root.querySelectorAll?.(TEXT_LEAF_SELECTOR).forEach(applyTextLeafDirection);
    if (root.matches && root.matches("[data-codex-rtl='true']")) {
      isolateMathRuns(root);
      isolateLatinRuns(root);
    }
    root.querySelectorAll?.("[data-codex-rtl='true']").forEach((element) => {
      isolateMathRuns(element);
      isolateLatinRuns(element);
    });
  }

  function flushPending() {
    const batch = Array.from(pending).slice(0, 25);
    batch.forEach((root) => pending.delete(root));
    batch.forEach(scan);

    if (pending.size > 0) {
      requestAnimationFrame(flushPending);
    } else {
      scheduled = false;
    }
  }

  function scheduleScan(root) {
    if (!root || root.nodeType !== Node.ELEMENT_NODE) return;
    const scanRoot = root.closest?.("[class*='codeBlock' i], [data-testid*='code' i]")
      || root.closest?.("code")
      || root;
    if (isInteractive(scanRoot) && !isMarkdownEditor(scanRoot)) return;
    pending.add(scanRoot);
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(flushPending);
  }

  ensureStyle();
  scan(document.body);

  if (window.__CODEX_RTL_OBSERVER__) {
    window.__CODEX_RTL_OBSERVER__.disconnect();
  }

  window.__CODEX_RTL_OBSERVER__ = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "characterData") {
        scheduleScan(mutation.target.parentElement);
      }
      if (
        mutation.type === "attributes"
        && mutation.target.matches?.(".cm-line")
        && isMarkdownEditor(mutation.target)
      ) {
        scheduleScan(mutation.target);
      }
      for (const node of mutation.addedNodes) {
        scheduleScan(node.nodeType === Node.TEXT_NODE ? node.parentElement : node);
      }
    }
  });

  window.__CODEX_RTL_OBSERVER__.observe(document.body, {
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["dir", "data-codex-markdown-editor-direction"],
    subtree: true
  });

  window.__CODEX_RTL_ACTIVE__ = true;
})();
