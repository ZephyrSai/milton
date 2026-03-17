const EXIT_NODES = new Set(["CLI_Resume", "CLI_exit", "exit"]);
const EXCLUSIVE_FLAG_GROUPS = [
  ["humanbeing", "citizen", "negativeentropy", "rationalanimal", "problemsolving"],
  ["Physicalist", "Religious", "Dualist", "Functionalist"],
  ["WhatGodWantsFlag", "TruthFlag", "HeroFlag", "EscapeFlag"],
  ["PunishmentFlag", "PreparedFlag", "GoneWrongFlag", "MatrixFlag"],
];

export function cleanScalar(raw) {
  if (!raw) {
    return "";
  }

  let value = raw.trim();

  if (value.startsWith("[[")) {
    value = value.slice(2, -2);
  } else if (value.startsWith('"') && value.endsWith('"')) {
    value = value.slice(1, -1);
  }

  if (value.includes("=")) {
    value = value.slice(value.indexOf("=") + 1);
  }

  return normalizeText(value);
}

function normalizeText(text) {
  return text
    .replace(/\r/g, "")
    .replace(/%w\d+/g, "")
    .replace(/%s\d+/g, "")
    .replace(/%g\d+/g, "")
    .replace(/&gt;/g, ">")
    .replace(/<span class="strong">/g, "")
    .replace(/<\/span>/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function loadCorpus(fileNames, fetcher = defaultFetcher) {
  const blocks = [];

  for (const fileName of fileNames) {
    const source = await fetcher(fileName);
    blocks.push(...parseDlgSource(fileName, source));
  }

  return blocks;
}

export async function loadReferenceArchive(fetcher = defaultFetcher) {
  const source = await fetcher("FoundTexts.dlg");
  return parseFoundTextsSource(source);
}

async function defaultFetcher(fileName) {
  const response = await fetch(fileName);
  if (!response.ok) {
    throw new Error(`Failed to load ${fileName}`);
  }
  return response.text();
}

export function parseFoundTextsSource(source) {
  const text = stripBom(source);
  const references = new Map();
  let cursor = 0;

  while (cursor < text.length) {
    const idx = text.indexOf('terminal when ("', cursor);
    if (idx === -1) {
      break;
    }

    const fileStart = idx + 'terminal when ("'.length;
    const fileEnd = text.indexOf('")', fileStart);
    const fileName = text.slice(fileStart, fileEnd);
    const braceStart = text.indexOf("{", fileEnd);
    const { content, nextIndex } = readBalanced(text, braceStart, "{", "}");
    const payload = extractStructuredValue(content, "show_text");

    if (payload) {
      references.set(fileName, cleanScalar(payload));
    }

    cursor = nextIndex;
  }

  return references;
}

export function parseDlgSource(fileName, source) {
  const text = stripBom(source);
  const blocks = [];
  let cursor = 0;
  let order = 0;

  while (cursor < text.length) {
    const terminalIndex = text.indexOf("terminal when", cursor);
    const playerIndex = text.indexOf("player when", cursor);
    let start = -1;
    let kind = null;

    if (terminalIndex !== -1 && (playerIndex === -1 || terminalIndex < playerIndex)) {
      start = terminalIndex;
      kind = "terminal";
    } else if (playerIndex !== -1) {
      start = playerIndex;
      kind = "player";
    }

    if (start === -1) {
      break;
    }

    const whenIndex = text.indexOf("when", start);
    const conditionStart = text.indexOf("(", whenIndex);
    const conditionRead = readBalanced(text, conditionStart, "(", ")");
    const bodyStart = text.indexOf("{", conditionRead.nextIndex);
    const bodyRead = readBalanced(text, bodyStart, "{", "}");
    const body = bodyRead.content;

    blocks.push(parseBlock(fileName, kind, conditionRead.content, body, order));
    order += 1;
    cursor = bodyRead.nextIndex;
  }

  return blocks;
}

function stripBom(value) {
  return value.replace(/^\uFEFF/, "");
}

function readBalanced(text, startIndex, openChar, closeChar) {
  let depth = 0;
  let index = startIndex;

  while (index < text.length) {
    const char = text[index];

    if (char === openChar) {
      depth += 1;
    } else if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return {
          content: text.slice(startIndex + 1, index),
          nextIndex: index + 1,
        };
      }
    }

    index += 1;
  }

  throw new Error(`Unbalanced structure starting at ${startIndex}`);
}

function parseBlock(fileName, kind, conditionSource, body, order) {
  const optionsBlock = extractOptionsBlock(body);
  const inlineNext = extractBareAction(body, "next");
  const inlineSetFlags = extractRepeatedActions(body, "set");
  const inlineClearFlags = extractRepeatedActions(body, "clear");
  const inlineTextValue =
    extractStructuredValue(body, "text") ?? extractStructuredValue(body, "prompt");
  const options = optionsBlock
    ? parseOptions(fileName, order, optionsBlock)
    : kind === "player" && inlineTextValue && inlineNext
      ? [
          {
            id: `${fileName}:${order}:option:0`,
            label: cleanScalar(inlineTextValue),
            shortLabel: "",
            next: inlineNext,
            setFlags: inlineSetFlags,
            clearFlags: inlineClearFlags,
          },
        ]
      : [];
  const contentType =
    kind === "player"
      ? null
      : extractStructuredValue(body, "prompt") !== null
      ? "prompt"
      : extractStructuredValue(body, "text") !== null
        ? "text"
        : extractStructuredValue(body, "show_text") !== null
          ? "show_text"
          : null;

  const contentValue =
    kind === "player"
      ? null
      : extractStructuredValue(body, "prompt") ??
        extractStructuredValue(body, "text") ??
        extractStructuredValue(body, "show_text");

  return {
    id: `${fileName}:${order}`,
    fileName,
    kind,
    order,
    conditionSource: conditionSource.trim(),
    conditionAst: parseCondition(conditionSource.trim()),
    contentType,
    content: contentValue ? cleanScalar(contentValue) : "",
    notext: /\bnotext\b/.test(body),
    goto: extractBareAction(body, "goto"),
    setFlags: extractRepeatedActions(body, "set"),
    setLocalFlags: extractRepeatedActions(body, "setlocal"),
    clearFlags: extractRepeatedActions(body, "clear"),
    options,
  };
}

function extractStructuredValue(body, key) {
  const regex = new RegExp(`(?:^|\\n)\\s*${key}\\s*:\\s*`, "m");
  const match = regex.exec(body);

  if (!match) {
    return null;
  }

  let cursor = match.index + match[0].length;

  while (cursor < body.length && /\s/.test(body[cursor])) {
    cursor += 1;
  }

  if (body.startsWith("[[", cursor)) {
    const end = body.indexOf("]]", cursor);
    return body.slice(cursor, end + 2);
  }

  if (body[cursor] === '"') {
    let end = cursor + 1;
    while (end < body.length) {
      if (body[end] === '"' && body[end - 1] !== "\\") {
        break;
      }
      end += 1;
    }
    return body.slice(cursor, end + 1);
  }

  const lineEnd = body.indexOf("\n", cursor);
  return body.slice(cursor, lineEnd === -1 ? body.length : lineEnd);
}

function extractOptionsBlock(body) {
  const match = /options\s*:\s*\{/m.exec(body);
  if (!match) {
    return null;
  }

  const start = match.index + match[0].length - 1;
  return readBalanced(body, start, "{", "}").content;
}

function parseOptions(fileName, order, raw) {
  const options = [];
  const lines = raw.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const line = stripInlineComment(lines[index]).trim();
    if (!line.startsWith('"')) {
      continue;
    }

    const labelMatch = line.match(/^"((?:[^"\\]|\\.)*)"/);
    if (!labelMatch) {
      continue;
    }

    const rawLabel = labelMatch[0];
    const label = cleanScalar(rawLabel);
    const short = extractQuotedAttribute(line, "short");
    const next = extractBareAttribute(line, "next");
    const setFlags = extractRepeatedAttributes(line, "set");
    const clearFlags = extractRepeatedAttributes(line, "clear");

    options.push({
      id: `${fileName}:${order}:option:${options.length}`,
      label,
      shortLabel: short ? cleanScalar(short) : "",
      next,
      setFlags,
      clearFlags,
    });
  }

  return options;
}

function stripInlineComment(line) {
  let inQuote = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index - 1] !== "\\") {
      inQuote = !inQuote;
    }
    if (char === "#" && !inQuote) {
      return line.slice(0, index);
    }
  }

  return line;
}

function extractQuotedAttribute(line, key) {
  const regex = new RegExp(`${key}\\s*:\\s*("(?:[^"\\\\]|\\\\.)*")`);
  const match = regex.exec(line);
  return match ? match[1] : null;
}

function extractBareAttribute(line, key) {
  const regex = new RegExp(`${key}\\s*:\\s*([A-Za-z_][A-Za-z0-9_]*)`);
  const match = regex.exec(line);
  return match ? match[1] : null;
}

function extractRepeatedAttributes(line, key) {
  const regex = new RegExp(`${key}\\s*:\\s*([A-Za-z_][A-Za-z0-9_]*)`, "g");
  return [...line.matchAll(regex)].map((match) => match[1]);
}

function extractBareAction(body, key) {
  return extractBareAttribute(body, key);
}

function extractRepeatedActions(body, key) {
  return extractRepeatedAttributes(body, key);
}

function tokenizeCondition(conditionSource) {
  const tokens = [];
  let cursor = 0;

  while (cursor < conditionSource.length) {
    const char = conditionSource[cursor];

    if (/\s/.test(char)) {
      cursor += 1;
      continue;
    }

    if (char === "(" || char === ")") {
      tokens.push({ type: char, value: char });
      cursor += 1;
      continue;
    }

    if (char === '"') {
      let end = cursor + 1;
      while (end < conditionSource.length) {
        if (conditionSource[end] === '"' && conditionSource[end - 1] !== "\\") {
          break;
        }
        end += 1;
      }
      tokens.push({
        type: "identifier",
        value: cleanScalar(conditionSource.slice(cursor, end + 1)),
      });
      cursor = end + 1;
      continue;
    }

    const wordMatch = /^[A-Za-z_][A-Za-z0-9_]*/.exec(conditionSource.slice(cursor));
    if (wordMatch) {
      const word = wordMatch[0];
      const lower = word.toLowerCase();
      if (lower === "and" || lower === "or" || lower === "not") {
        tokens.push({ type: lower, value: lower });
      } else {
        tokens.push({ type: "identifier", value: word });
      }
      cursor += word.length;
      continue;
    }

    cursor += 1;
  }

  return tokens;
}

function parseCondition(source) {
  const tokens = tokenizeCondition(source);
  let cursor = 0;

  function parseExpression() {
    return parseOr();
  }

  function parseOr() {
    let node = parseAnd();
    while (tokens[cursor]?.type === "or") {
      cursor += 1;
      node = { type: "or", left: node, right: parseAnd() };
    }
    return node;
  }

  function parseAnd() {
    let node = parseNot();
    while (tokens[cursor]?.type === "and") {
      cursor += 1;
      node = { type: "and", left: node, right: parseNot() };
    }
    return node;
  }

  function parseNot() {
    if (tokens[cursor]?.type === "not") {
      cursor += 1;
      return { type: "not", value: parseNot() };
    }
    return parsePrimary();
  }

  function parsePrimary() {
    const token = tokens[cursor];
    if (!token) {
      return { type: "identifier", value: "" };
    }

    if (token.type === "(") {
      cursor += 1;
      const expression = parseExpression();
      if (tokens[cursor]?.type === ")") {
        cursor += 1;
      }
      return expression;
    }

    cursor += 1;
    return { type: "identifier", value: token.value };
  }

  return parseExpression();
}

function evaluateCondition(ast, context) {
  if (!ast) {
    return true;
  }

  switch (ast.type) {
    case "identifier":
      return context.flags.has(ast.value) || context.currentNode === ast.value;
    case "not":
      return !evaluateCondition(ast.value, context);
    case "and":
      return evaluateCondition(ast.left, context) && evaluateCondition(ast.right, context);
    case "or":
      return evaluateCondition(ast.left, context) || evaluateCondition(ast.right, context);
    default:
      return false;
  }
}

export class MiltonRuntime {
  constructor({ blocks, sessions, interludes, savedState }) {
    this.blocks = [...blocks].sort((left, right) => left.order - right.order);
    this.sessions = sessions;
    this.interludes = interludes;
    this.state = savedState
      ? hydrateState(savedState)
      : {
          flags: new Set(["MiltonAllowed"]),
          currentNode: null,
          currentSessionIndex: 0,
          consumedSessions: [],
          pendingSeedFlags: [],
          transcript: [],
          currentStepKey: "",
          currentView: null,
          referenceOpens: [],
        };
  }

  serialize() {
    return {
      flags: [...this.state.flags],
      currentNode: this.state.currentNode,
      currentSessionIndex: this.state.currentSessionIndex,
      consumedSessions: this.state.consumedSessions,
      pendingSeedFlags: this.state.pendingSeedFlags,
      transcript: this.state.transcript,
      currentStepKey: this.state.currentStepKey,
      currentView: this.state.currentView,
      referenceOpens: this.state.referenceOpens,
    };
  }

  reset() {
    this.state = {
      flags: new Set(["MiltonAllowed"]),
      currentNode: null,
      currentSessionIndex: 0,
      consumedSessions: [],
      pendingSeedFlags: [],
      transcript: [],
      currentStepKey: "",
      currentView: null,
      referenceOpens: [],
    };
    return this.resolve();
  }

  resolve() {
    this.seedCurrentSession();
    this.processAutomaticTransitions();
    const view = this.buildCurrentView();
    this.consumeCurrentSessionSeed();
    this.state.currentView = view;
    return view;
  }

  choose(optionId) {
    const view = this.state.currentView ?? this.resolve();
    const option = view.options.find((entry) => entry.id === optionId);
    if (!option) {
      return view;
    }

    this.state.transcript.push({
      role: "user",
      label: "Response",
      text: option.shortLabel || option.label,
    });

    for (const flag of option.setFlags) {
      this.applyExclusiveFlag(flag);
    }
    for (const flag of option.clearFlags) {
      this.state.flags.delete(flag);
    }

    this.state.currentNode = option.next;
    this.state.currentStepKey = "";
    return this.resolve();
  }

  continue() {
    const view = this.state.currentView ?? this.resolve();

    if (view.pendingGoto) {
      this.state.currentNode = view.pendingGoto;
      this.state.currentStepKey = "";
      return this.resolve();
    }

    if (view.boundary?.completed && this.state.currentSessionIndex < this.sessions.length - 1) {
      this.state.currentSessionIndex += 1;
      this.state.currentNode = null;
      this.state.currentStepKey = "";
      this.state.transcript.push({
        role: "event",
        label: "System",
        text: `Boot sequence advanced to ${this.sessions[this.state.currentSessionIndex].label}.`,
      });
      return this.resolve();
    }

    if (view.boundary && !view.boundary.completed) {
      const session = this.sessions[this.state.currentSessionIndex];
      this.state.consumedSessions = this.state.consumedSessions.filter(
        (entry) => entry !== session.id,
      );
      this.state.currentNode = null;
      this.state.currentStepKey = "";
      this.state.transcript.push({
        role: "event",
        label: "System",
        text: `Reconnecting ${session.label}.`,
      });
      return this.resolve();
    }

    return view;
  }

  openReference(referenceId) {
    if (!this.state.referenceOpens.includes(referenceId)) {
      this.state.referenceOpens.push(referenceId);
    }
  }

  launchInterlude(interludeId) {
    const interlude = this.interludes.find((entry) => entry.id === interludeId);
    if (!interlude) {
      return this.state.currentView ?? this.resolve();
    }

    for (const flag of interlude.seedFlags) {
      this.state.flags.add(flag);
    }
    this.state.pendingSeedFlags = [...interlude.seedFlags];
    this.state.currentNode = null;
    this.state.currentStepKey = "";
    this.state.transcript.push({
      role: "event",
      label: "Interlude",
      text: `Opening ${interlude.label}.`,
    });
    return this.resolve();
  }

  seedCurrentSession() {
    const session = this.sessions[this.state.currentSessionIndex];
    if (!session || this.state.consumedSessions.includes(session.id)) {
      return;
    }

    for (const flag of session.seedFlags) {
      this.state.flags.add(flag);
    }
    this.state.pendingSeedFlags = [...session.seedFlags];
  }

  processAutomaticTransitions() {
    let iterations = 0;

    while (iterations < 80) {
      iterations += 1;

      const matching = this.matchingBlocks();
      let changed = false;

      for (const block of matching) {
        changed = this.applyBlockActions(block) || changed;
      }

      const autoGoto = matching.find(
        (block) => block.goto && !block.content && block.options.length === 0,
      );

      if (autoGoto && this.state.currentNode !== autoGoto.goto) {
        this.state.currentNode = autoGoto.goto;
        changed = true;
        continue;
      }

      if (!changed) {
        break;
      }
    }
  }

  consumeCurrentSessionSeed() {
    if (!this.state.pendingSeedFlags.length) {
      return;
    }

    for (const flag of this.state.pendingSeedFlags) {
      this.state.flags.delete(flag);
    }

    this.state.flags.add("Booting");
    this.state.flags.add("MiltonAllowed");
    const session = this.sessions[this.state.currentSessionIndex];
    if (session && !this.state.consumedSessions.includes(session.id)) {
      this.state.consumedSessions.push(session.id);
    }
    this.state.pendingSeedFlags = [];
  }

  applyBlockActions(block) {
    let changed = false;

    for (const flag of [...block.setFlags, ...block.setLocalFlags]) {
      const before = this.state.flags.has(flag);
      this.applyExclusiveFlag(flag);
      changed = changed || !before;
    }

    for (const flag of block.clearFlags) {
      if (this.state.flags.delete(flag)) {
        changed = true;
      }
    }

    return changed;
  }

  matchingBlocks() {
    const context = {
      flags: this.state.flags,
      currentNode: this.state.currentNode,
    };
    return this.blocks.filter((block) => evaluateCondition(block.conditionAst, context));
  }

  buildCurrentView() {
    const matching = this.matchingBlocks();
    const textParts = [];
    const options = [];
    let pendingGoto = null;

    for (const block of matching) {
      if (block.content) {
        textParts.push(block.content);
      }

      if (block.options.length > 0) {
        options.push(...block.options);
      }

      if (block.goto) {
        pendingGoto = block.goto;
      }
    }

    const combinedText = textParts.filter(Boolean).join("\n\n").trim();
    const stepKey = JSON.stringify({
      session: this.state.currentSessionIndex,
      node: this.state.currentNode,
      text: combinedText,
      options: options.map((option) => option.id),
      pendingGoto,
    });

    if (combinedText && this.state.currentStepKey !== stepKey) {
      this.state.transcript.push({
        role: "system",
        label: "MILTON",
        text: combinedText,
      });
    }

    this.state.currentStepKey = stepKey;

    const session = this.sessions[this.state.currentSessionIndex];
    const completed = session ? this.state.flags.has(session.doneFlag) : false;
    const boundary = EXIT_NODES.has(this.state.currentNode)
      ? {
          completed,
          sessionLabel: session?.label ?? "Session",
        }
      : null;

    return {
      session,
      text: combinedText,
      options,
      pendingGoto:
        options.length === 0 && pendingGoto ? pendingGoto : null,
      boundary,
      transcript: this.state.transcript,
      flags: [...this.state.flags],
      currentNode: this.state.currentNode,
      referenceOpens: this.state.referenceOpens,
    };
  }

  applyExclusiveFlag(flag) {
    const group = EXCLUSIVE_FLAG_GROUPS.find((entry) => entry.includes(flag));
    if (group) {
      for (const sibling of group) {
        if (sibling !== flag) {
          this.state.flags.delete(sibling);
        }
      }
    }
    this.state.flags.add(flag);
  }
}

function hydrateState(savedState) {
  const flags = new Set(savedState.flags ?? ["MiltonAllowed"]);
  for (const group of EXCLUSIVE_FLAG_GROUPS) {
    const active = group.filter((flag) => flags.has(flag));
    if (active.length > 1) {
      for (const flag of active.slice(0, -1)) {
        flags.delete(flag);
      }
    }
  }

  return {
    flags,
    currentNode: savedState.currentNode ?? null,
    currentSessionIndex: savedState.currentSessionIndex ?? 0,
    consumedSessions: savedState.consumedSessions ?? [],
    pendingSeedFlags: savedState.pendingSeedFlags ?? [],
    transcript: savedState.transcript ?? [],
    currentStepKey: savedState.currentStepKey ?? "",
    currentView: savedState.currentView ?? null,
    referenceOpens: savedState.referenceOpens ?? [],
  };
}
