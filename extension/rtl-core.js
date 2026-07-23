(function initCodexRtlCore(global) {
  const RTL_RANGES = [
    [0x0590, 0x08ff], [0xfb1d, 0xfdff], [0xfe70, 0xfeff],
    [0x10800, 0x10fff], [0x1e800, 0x1edff]
  ];
  const RTL_CHAR_RE = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/u;
  const LATIN_RE = /[A-Za-z]/;
  const LATEX_SIGNAL_RE = /[\\^_{}]|\b(?:frac|sqrt|sum|prod|int|lim|infty|cdot|times|div|leq|geq|neq|approx|begin|end|matrix)\b/;
  const MATH_OPERATOR_RE = /[+\-*/=<>%×÷±−≤≥≠≈→·•∙∗⋅√]/u;

  function isRtlCodePoint(codePoint) {
    return RTL_RANGES.some(([start, end]) => codePoint >= start && codePoint <= end);
  }

  function hasRtl(text) {
    for (const character of String(text || "")) {
      if (isRtlCodePoint(character.codePointAt(0))) return true;
    }
    return false;
  }

  function classifyText(text) {
    const value = String(text || "");
    if (!hasRtl(value)) return "auto";
    let rtlCount = 0;
    for (const character of value) {
      if (isRtlCodePoint(character.codePointAt(0))) rtlCount += 1;
    }
    const latinCount = (value.match(/[A-Za-z]/g) || []).length;
    return rtlCount >= Math.max(2, latinCount * 0.25) ? "rtl" : "auto";
  }

  function firstStrong(text) {
    for (const character of String(text || "")) {
      const codePoint = character.codePointAt(0);
      if (isRtlCodePoint(codePoint)) return "rtl";
      if (LATIN_RE.test(character)) return "ltr";
    }
    return null;
  }

  function findLatexRanges(text) {
    const value = String(text || "");
    const ranges = [];
    const claim = (expression, needsSignal = false) => {
      for (const match of value.matchAll(expression)) {
        const start = match.index;
        const end = start + match[0].length;
        if (ranges.some(([a, b]) => start < b && end > a)) continue;
        if (needsSignal && !LATEX_SIGNAL_RE.test(match[0].slice(1, -1))) continue;
        ranges.push([start, end]);
      }
    };
    claim(/\$\$[\s\S]+?\$\$/g);
    claim(/\\\[[\s\S]+?\\\]/g);
    claim(/\\\([\s\S]+?\\\)/g);
    claim(/\$[^$\n]+?\$/g, true);
    return ranges.sort((a, b) => a[0] - b[0]);
  }

  function findMathRanges(text) {
    const value = String(text || "");
    const ranges = [];
    let base = 0;
    for (const line of value.split("\n")) {
      const tokens = Array.from(line.matchAll(/\S+/g));
      let index = 0;
      while (index < tokens.length) {
        const isMathToken = (token) => /^(?:[0-9.,:;()\[\]{}|+\-*/=<>%×÷±−≤≥≠≈→·•∙∗⋅√]+|[A-Za-z])$/u.test(token);
        if (!isMathToken(tokens[index][0])) { index += 1; continue; }
        let endIndex = index;
        while (endIndex + 1 < tokens.length && isMathToken(tokens[endIndex + 1][0])) endIndex += 1;
        const start = base + tokens[index].index;
        let end = base + tokens[endIndex].index + tokens[endIndex][0].length;
        while (/[.,:;]/.test(value[end - 1] || "")) end -= 1;
        const candidate = value.slice(start, end);
        if (/\d/.test(candidate) && MATH_OPERATOR_RE.test(candidate) && !candidate.includes("$")) {
          ranges.push([start, end]);
        }
        index = endIndex + 1;
      }
      base += line.length + 1;
    }
    return ranges;
  }

  function segmentText(text) {
    const value = String(text || "");
    const ranges = findLatexRanges(value);
    for (const range of findMathRanges(value)) {
      if (!ranges.some(([a, b]) => range[0] < b && range[1] > a)) ranges.push(range);
    }
    ranges.sort((a, b) => a[0] - b[0]);
    if (!ranges.length) return value ? [{ type: "text", value }] : [];
    const segments = [];
    let offset = 0;
    for (const [start, end] of ranges) {
      if (start > offset) segments.push({ type: "text", value: value.slice(offset, start) });
      segments.push({ type: "math", value: value.slice(start, end) });
      offset = end;
    }
    if (offset < value.length) segments.push({ type: "text", value: value.slice(offset) });
    return segments;
  }

  function cellDirection(text) {
    if (hasRtl(text)) return "rtl";
    return firstStrong(text) === "ltr" ? "ltr" : null;
  }

  function tableDirection(headerDirections, firstColumnDirections) {
    const majority = (directions) => {
      const rtl = directions.filter((direction) => direction === "rtl").length;
      const ltr = directions.filter((direction) => direction === "ltr").length;
      return rtl > ltr ? "rtl" : ltr > rtl ? "ltr" : null;
    };
    if (headerDirections[0] === "rtl" && firstColumnDirections[0] === "rtl") return "rtl";
    const header = majority(headerDirections);
    if (header) return header === "rtl" ? "rtl" : null;
    return majority(firstColumnDirections) === "rtl" ? "rtl" : null;
  }

  global.__CODEX_RTL_CORE__ = {
    RTL_CHAR_RE, hasRtl, classifyText, firstStrong, findLatexRanges,
    findMathRanges, segmentText, cellDirection, tableDirection
  };
})(globalThis);
