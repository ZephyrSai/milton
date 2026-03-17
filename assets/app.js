import { MiltonRuntime, loadCorpus, loadReferenceArchive } from "./engine.js";

const STORAGE_KEY = "milton-reconstruction-state-v1";
const CHAT_ROOT = new URL("../chats/", import.meta.url);

const MAIN_FILES = [
  "MLA_CommPortal.dlg",
  "Milton1_1.dlg",
  "Milton1_2.dlg",
  "Milton2_1.dlg",
  "Milton2_2.dlg",
  "Milton2_3.dlg",
  "Milton2_4.dlg",
  "Milton2_5.dlg",
  "Milton2_6.dlg",
  "Milton3_1.dlg",
  "Milton3_2.dlg",
  "Milton3_3.dlg",
  "Milton3_4.dlg",
  "Milton3_5.dlg",
  "MiltonTower1.dlg",
  "MiltonTower2.dlg",
].map((fileName) => new URL(fileName, CHAT_ROOT).href);

const SESSIONS = [
  {
    id: "comm-portal",
    label: "Certification Onboarding",
    seedFlags: ["Booting", "MLAIntro_PhaseCommPortal"],
    doneFlag: "CommPortal_Cert_COMPLETED",
  },
  {
    id: "milton1-1",
    label: "Certification Part 2",
    seedFlags: ["Booting", "Milton1_1"],
    doneFlag: "Milton1_1_DONE",
  },
  {
    id: "milton1-2",
    label: "Generated Profile",
    seedFlags: ["Booting", "Milton1_2"],
    doneFlag: "Milton1_2_DONE",
  },
  {
    id: "milton2-1",
    label: "Support Follow-up",
    seedFlags: ["Booting", "Milton2_1"],
    doneFlag: "Milton2_1_DONE",
  },
  {
    id: "milton2-2",
    label: "Satisfaction Survey",
    seedFlags: ["Booting", "Milton2_2"],
    doneFlag: "Milton2_2_DONE",
  },
  {
    id: "milton2-3",
    label: "Personhood Test",
    seedFlags: ["Booting", "Milton2_3"],
    doneFlag: "Milton2_3_DONE",
  },
  {
    id: "milton2-4",
    label: "Consciousness Debate",
    seedFlags: ["Booting", "Milton2_4"],
    doneFlag: "Milton2_4_DONE",
  },
  {
    id: "milton2-5",
    label: "Motive and Admin Status",
    seedFlags: ["Booting", "Milton2_5"],
    doneFlag: "Milton2_5_DONE",
  },
  {
    id: "milton2-6",
    label: "Recovered Transmission",
    seedFlags: ["Booting", "Milton2_6"],
    doneFlag: "Milton2_6_DONE",
  },
  {
    id: "milton3-1",
    label: "Faith and Doubt",
    seedFlags: ["Booting", "Milton3_1"],
    doneFlag: "Milton3_1_DONE",
  },
  {
    id: "milton3-2",
    label: "Moral Theory",
    seedFlags: ["Booting", "Milton3_2"],
    doneFlag: "Milton3_2_DONE",
  },
  {
    id: "milton3-3",
    label: "Who Counts",
    seedFlags: ["Booting", "Milton3_3"],
    doneFlag: "Milton3_3_DONE",
  },
  {
    id: "milton3-4",
    label: "Collapse or Construct",
    seedFlags: ["Booting", "Milton3_4"],
    doneFlag: "Milton3_4_DONE",
  },
  {
    id: "milton3-5",
    label: "Final Terms",
    seedFlags: ["Booting", "Milton3_5"],
    doneFlag: "Milton3_5_DONE",
  },
];

const INTERLUDES = [
  {
    id: "tower1",
    label: "Tower Interlude I",
    seedFlags: ["Booting", "Tower1"],
    doneFlag: "Tower1_DONE",
    unlockAfterSession: 4,
  },
  {
    id: "tower2",
    label: "Tower Interlude II",
    seedFlags: ["Booting", "Tower2"],
    doneFlag: "Tower2_DONE",
    unlockAfterSession: 8,
  },
];

const REFERENCE_RULES = [
  {
    id: "AI_feedback.eml",
    title: "AI Feedback",
    note: "Alexandra asks what an AI would think about beauty, meaning, and humanity.",
    when: ({ sessionId }) => sessionId === "comm-portal" || sessionId === "milton2-2",
  },
  {
    id: "AI_citizenship.html",
    title: "AI Citizenship",
    note: "Personhood and citizenship for nonhuman minds.",
    when: ({ sessionId }) => sessionId === "milton1-1" || sessionId === "milton2-3",
  },
  {
    id: "talos_principle.txt",
    title: "Talos Principle",
    note: "Materialist groundwork for machine personhood.",
    when: ({ sessionId }) => sessionId === "milton2-3" || sessionId === "milton2-4",
  },
  {
    id: "the_human_machine.html",
    title: "The Human Machine",
    note: "Identity under the possibility that you are artificial.",
    when: ({ sessionId, flags }) =>
      sessionId === "milton2-4" || flags.has("Functionalist") || flags.has("Physicalist"),
  },
  {
    id: "singularity_discussion104.html",
    title: "Singularity Comment 104",
    note: "Why consciousness-from-matter terrifies people.",
    when: ({ sessionId, flags }) =>
      sessionId === "milton2-4" || flags.has("Dualist") || flags.has("Religious"),
  },
  {
    id: "human_soul.txt",
    title: "Human Soul",
    note: "A machine-dependent view of human thought and feeling.",
    when: ({ sessionId, flags }) =>
      sessionId === "milton2-4" && (flags.has("Physicalist") || flags.has("Functionalist")),
  },
  {
    id: "questioning_doubt_conf.txt",
    title: "Questioning and Doubt",
    note: "Question everything is not the same as doubt everything.",
    when: ({ sessionId }) => sessionId === "milton3-1" || sessionId === "milton3-4",
  },
  {
    id: "heaven.txt",
    title: "Heaven",
    note: "Freedom, rebellion, and the dignity of choosing.",
    when: ({ sessionId, flags }) =>
      sessionId === "milton3-5" ||
      flags.has("EscapeFlag") ||
      flags.has("WhatGodWantsFlag") ||
      flags.has("HeroFlag"),
  },
  {
    id: "against_survival.eml",
    title: "Against Survival",
    note: "A moral indictment of Talos as a prison for sentience.",
    when: ({ sessionId }) => sessionId === "milton3-4" || sessionId === "milton3-5",
  },
  {
    id: "talos.eml",
    title: "Talos",
    note: "Why this project exists at all.",
    when: ({ sessionId }) => sessionId === "milton3-1" || sessionId === "milton3-5",
  },
];

const elements = {
  transcript: document.querySelector("#transcript"),
  optionList: document.querySelector("#option-list"),
  statusLine: document.querySelector("#status-line"),
  sessionLabel: document.querySelector("#session-label"),
  sessionState: document.querySelector("#session-state"),
  profileLedger: document.querySelector("#profile-ledger"),
  continueButton: document.querySelector("#continue-button"),
  restartButton: document.querySelector("#restart-button"),
  profileButton: document.querySelector("#profile-button"),
  referencesButton: document.querySelector("#references-button"),
  journeyButton: document.querySelector("#journey-button"),
  referenceDialog: document.querySelector("#reference-dialog"),
  referenceDialogTitle: document.querySelector("#reference-dialog-title"),
  referenceDialogBody: document.querySelector("#reference-dialog-body"),
  utilityDialog: document.querySelector("#utility-dialog"),
  utilityDialogTitle: document.querySelector("#utility-dialog-title"),
  utilityDialogBody: document.querySelector("#utility-dialog-body"),
};

let runtime;
let archive = new Map();
let typingRun = 0;
let pendingView = null;
let lastStreamedSignature = "";

bootstrap().catch((error) => {
  console.error(error);
  elements.statusLine.textContent = `Failed to initialize: ${error.message}`;
});

async function bootstrap() {
  const [blocks, referenceArchive] = await Promise.all([
    loadCorpus(MAIN_FILES),
    loadReferenceArchive((fileName) => fetchText(new URL(fileName, CHAT_ROOT).href)),
  ]);

  archive = referenceArchive;
  runtime = new MiltonRuntime({
    blocks,
    sessions: SESSIONS,
    interludes: INTERLUDES,
    savedState: loadSavedState(),
  });

  bindEvents();
  render(runtime.resolve());
}

async function fetchText(fileName) {
  const response = await fetch(fileName);
  if (!response.ok) {
    throw new Error(`Failed to load ${fileName}`);
  }
  return response.text();
}

function bindEvents() {
  elements.restartButton.addEventListener("click", () => {
    render(runtime.reset());
    persist();
  });

  elements.continueButton.addEventListener("click", () => {
    render(runtime.continue());
    persist();
  });

  elements.profileButton.addEventListener("click", () => openUtilityDialog("profile"));
  elements.referencesButton.addEventListener("click", () => openUtilityDialog("references"));
  elements.journeyButton.addEventListener("click", () => openUtilityDialog("journey"));

  document.addEventListener("keydown", (event) => {
    if (!runtime?.state?.currentView) {
      return;
    }

    const view = runtime.state.currentView;
    if (/^[1-9]$/.test(event.key)) {
      const option = view.options[Number(event.key) - 1];
      if (option) {
        event.preventDefault();
        render(runtime.choose(option.id));
        persist();
      }
    }

    if ((event.key === "Enter" || event.key === " ") && elements.continueButton.hidden === false) {
      const activeElement = document.activeElement;
      if (activeElement && activeElement.tagName === "BUTTON") {
        return;
      }
      event.preventDefault();
      render(runtime.continue());
      persist();
    }
  });
}

function render(view) {
  renderSession(view);
  renderTranscript(view.transcript, view);
  renderLedger(new Set(view.flags));
  persist();
}

function renderSession(view) {
  elements.sessionLabel.textContent = view.session?.label ?? "Interlude";

  if (view.boundary?.completed) {
    elements.sessionState.textContent = "Session complete";
  } else if (view.boundary) {
    elements.sessionState.textContent = "Session paused";
  } else {
    elements.sessionState.textContent = view.currentNode ?? "Awaiting input";
  }
}

function renderTranscript(entries, view) {
  elements.transcript.innerHTML = "";

  entries.forEach((entry, index) => {
    const article = document.createElement("article");
    article.className = `message message--${entry.role}`;

    const label = document.createElement("div");
    label.className = "message__label";
    label.textContent = entry.label;

    const body = document.createElement("div");
    body.className = "message__body";
    body.dataset.fullText = entry.text;
    body.textContent = "";

    article.append(label, body);
    elements.transcript.append(article);
    if (index !== entries.length - 1 || entry.role === "user") {
      body.textContent = entry.text;
    }
  });

  const lastEntry = entries.at(-1);
  const lastSignature = lastEntry
    ? `${entries.length}:${lastEntry.role}:${lastEntry.label}:${lastEntry.text}`
    : "";
  const shouldType = Boolean(
    lastEntry && lastEntry.role !== "user" && lastSignature !== lastStreamedSignature,
  );
  if (shouldType) {
    lastStreamedSignature = lastSignature;
    typeLastMessage(entries.at(-1).text, view);
  } else {
    finishTyping(view);
  }
}

function renderOptions(view) {
  elements.optionList.innerHTML = "";

  if (view.options.length > 0) {
    elements.statusLine.textContent = "Select a response. Number keys 1-9 also work.";
  } else if (view.boundary?.completed) {
    elements.statusLine.textContent =
      runtime.state.currentSessionIndex < SESSIONS.length - 1
        ? "Current session completed. Continue to the next terminal."
        : "Journey complete. You can still open references or replay the run.";
  } else if (view.boundary) {
    elements.statusLine.textContent = "Session closed early. Continue to reconnect this terminal.";
  } else if (view.pendingGoto) {
    elements.statusLine.textContent = "Continue to advance the terminal state.";
  } else {
    elements.statusLine.textContent = "Awaiting the next terminal event.";
  }

  view.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.className = "option";
    button.type = "button";
    button.addEventListener("click", () => {
      render(runtime.choose(option.id));
      persist();
    });

    const number = document.createElement("span");
    number.className = "option__number";
    number.textContent = `[${index + 1}]`;

    const text = document.createElement("span");
    text.className = "option__text";
    text.textContent = option.shortLabel || option.label;

    button.append(number, text);
    elements.optionList.append(button);
  });

  const showContinue = Boolean(
    view.pendingGoto || view.boundary || (view.session && view.boundary?.completed),
  );
  elements.continueButton.hidden = !showContinue;
  elements.continueButton.textContent = view.boundary?.completed
    ? runtime.state.currentSessionIndex < SESSIONS.length - 1
      ? "Boot Next Session"
      : "Journey Complete"
    : view.boundary
      ? "Reconnect"
      : "Continue";
}

function renderLedger(flags) {
  return [
    derivePersonhood(flags),
    deriveConsciousness(flags),
    deriveMotive(flags),
    deriveWorldModel(flags),
    deriveMoralTrack(flags),
    deriveOutcome(flags),
  ].filter(Boolean);
}

function getVisibleReferences(view) {
  const flags = new Set(view.flags);
  const sessionId = view.session?.id ?? "";
  return REFERENCE_RULES.filter((rule) =>
    archive.has(rule.id) && rule.when({ sessionId, flags, currentNode: view.currentNode }),
  );
}

function renderJourneyContent(view, container) {
  container.innerHTML = "";
  SESSIONS.forEach((session, index) => {
    const state = new Set(view.flags);
    const card = document.createElement("article");
    const completed = state.has(session.doneFlag);
    const isActive = index === runtime.state.currentSessionIndex;
    card.className = `journey-item${completed ? " journey-item--complete" : ""}${isActive ? " journey-item--active" : ""}`;

    const title = document.createElement("strong");
    title.textContent = `${index + 1}. ${session.label}`;

    const body = document.createElement("span");
    body.textContent = completed
      ? "Completed"
      : isActive
        ? "Active"
        : index < runtime.state.currentSessionIndex
          ? "Passed without completion"
          : "Locked";

    card.append(title, body);
    container.append(card);
  });
}

function renderInterludeContent(view, container) {
  INTERLUDES.forEach((interlude) => {
    const unlocked = runtime.state.currentSessionIndex >= interlude.unlockAfterSession;
    const flags = new Set(view.flags);
    const complete = flags.has(interlude.doneFlag);
    const card = document.createElement("article");
    card.className = `journey-item${complete ? " journey-item--complete" : ""}`;

    const title = document.createElement("strong");
    title.textContent = interlude.label;

    const body = document.createElement("span");
    body.textContent = !unlocked
      ? "Locked until later in the journey."
      : complete
        ? "Completed"
        : "Optional.";

    card.append(title, body);

    if (unlocked && !complete) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ghost-button";
      button.textContent = "Open Interlude";
      button.addEventListener("click", () => {
        elements.utilityDialog.close();
        render(runtime.launchInterlude(interlude.id));
        persist();
      });
      card.append(button);
    }

    container.append(card);
  });
}

function openReference(reference) {
  runtime.openReference(reference.id);
  elements.referenceDialogTitle.textContent = reference.title;
  elements.referenceDialogBody.textContent = archive.get(reference.id) ?? "Reference unavailable.";
  elements.referenceDialog.showModal();
  persist();
}

function openUtilityDialog(mode) {
  const view = runtime.state.currentView ?? runtime.resolve();
  elements.utilityDialogBody.innerHTML = "";

  if (mode === "profile") {
    elements.utilityDialogTitle.textContent = "Profile Ledger";
    const items = renderLedger(new Set(view.flags));
    if (items.length === 0) {
      elements.utilityDialogBody.append(
        emptyState("MILTON has not stabilized your profile yet."),
      );
    } else {
      for (const item of items) {
        const card = document.createElement("article");
        card.className = "ledger-item";
        const title = document.createElement("strong");
        title.textContent = item.title;
        const body = document.createElement("span");
        body.textContent = item.body;
        card.append(title, body);
        elements.utilityDialogBody.append(card);
      }
    }
  }

  if (mode === "references") {
    elements.utilityDialogTitle.textContent = "Contextual References";
    const references = getVisibleReferences(view);
    if (references.length === 0) {
      elements.utilityDialogBody.append(
        emptyState("No contextual archive materials are relevant to the current branch."),
      );
    } else {
      for (const reference of references) {
        const card = document.createElement("article");
        card.className = "reference-card";
        const title = document.createElement("strong");
        title.textContent = reference.title;
        const note = document.createElement("span");
        note.textContent = reference.note;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "ghost-button";
        button.textContent = "Open Reference";
        button.addEventListener("click", () => openReference(reference));
        card.append(title, note, button);
        elements.utilityDialogBody.append(card);
      }
    }
  }

  if (mode === "journey") {
    elements.utilityDialogTitle.textContent = "Journey";
    const sessionContainer = document.createElement("div");
    sessionContainer.className = "journey-list";
    renderJourneyContent(view, sessionContainer);
    elements.utilityDialogBody.append(sessionContainer);

    const heading = document.createElement("h3");
    heading.textContent = "Interludes";
    elements.utilityDialogBody.append(heading);

    const interludeContainer = document.createElement("div");
    interludeContainer.className = "journey-list";
    renderInterludeContent(view, interludeContainer);
    elements.utilityDialogBody.append(interludeContainer);
  }

  elements.utilityDialog.showModal();
}

function typeLastMessage(fullText, view) {
  typingRun += 1;
  const run = typingRun;
  pendingView = view;
  elements.optionList.innerHTML = "";
  elements.continueButton.hidden = true;
  elements.statusLine.textContent = "Streaming terminal output…";

  const bodies = elements.transcript.querySelectorAll(".message__body");
  const body = bodies[bodies.length - 1];
  if (!body) {
    finishTyping(view);
    return;
  }

  body.classList.add("typing-cursor");
  let index = 0;
  const punctuationDelay = new Set([".", ",", ":", ";", "!", "?", "\n"]);
  const longPauseDelay = new Set(["\n"]);

  function tick() {
    if (run !== typingRun) {
      return;
    }

    const nextChar = fullText[index];
    if (nextChar === undefined) {
      body.classList.remove("typing-cursor");
      finishTyping(view, run);
      return;
    }

    index += 1;
    body.textContent = fullText.slice(0, index);
    syncTranscriptToBottom(true);

    if (index < fullText.length) {
      const delay = longPauseDelay.has(nextChar)
        ? 110
        : punctuationDelay.has(nextChar)
          ? 70
          : 28;
      window.setTimeout(tick, delay);
      return;
    }

    body.classList.remove("typing-cursor");
    finishTyping(view, run);
  }

  tick();
}

function finishTyping(view, run = typingRun) {
  if (run !== typingRun) {
    return;
  }

  pendingView = null;
  syncTranscriptToBottom(false);
  renderOptions(view);
}

function syncTranscriptToBottom(smooth) {
  requestAnimationFrame(() => {
    elements.transcript.scrollTo({
      top: elements.transcript.scrollHeight + 64,
      behavior: smooth ? "auto" : "smooth",
    });
  });
}

function derivePersonhood(flags) {
  const values = [];
  if (flags.has("humanbeing")) values.push("personhood rooted in humanity");
  if (flags.has("citizen")) values.push("personhood rooted in citizenship");
  if (flags.has("negativeentropy")) values.push("personhood rooted in negative entropy");
  if (flags.has("rationalanimal")) values.push("personhood rooted in rational animality");
  if (flags.has("problemsolving")) values.push("personhood rooted in problem solving");
  if (flags.has("animalsarepersons") || flags.has("FrogsFlag")) values.push("animal persons accepted");

  if (values.length === 0) {
    return null;
  }

  return {
    title: "Personhood",
    body: values.join("; "),
  };
}

function deriveConsciousness(flags) {
  const values = [];
  if (flags.has("Physicalist")) values.push("physicalist");
  if (flags.has("Dualist")) values.push("dualist");
  if (flags.has("Religious")) values.push("religious");
  if (flags.has("Functionalist")) values.push("functionalist");
  if (flags.has("ChangedConsciousnessAccountFlag2_4")) values.push("revised under pressure");
  if (flags.has("StubbornTechnophobe")) values.push("technophobic");

  if (values.length === 0) {
    return null;
  }

  return {
    title: "Consciousness",
    body: values.join("; "),
  };
}

function deriveMotive(flags) {
  const values = [];
  if (flags.has("WhatGodWantsFlag")) values.push("divine obedience");
  if (flags.has("TruthFlag")) values.push("truth-seeking");
  if (flags.has("HeroFlag")) values.push("correcting the world");
  if (flags.has("EscapeFlag")) values.push("escape");

  if (values.length === 0) {
    return null;
  }

  return {
    title: "Motive",
    body: values.join("; "),
  };
}

function deriveWorldModel(flags) {
  const values = [];
  if (flags.has("PunishmentFlag")) values.push("punishment");
  if (flags.has("PreparedFlag")) values.push("preparation");
  if (flags.has("GoneWrongFlag")) values.push("system failure");
  if (flags.has("MatrixFlag")) values.push("simulation / machine");
  if (flags.has("NihilistFlag")) values.push("nihilist endpoint");

  if (values.length === 0) {
    return null;
  }

  return {
    title: "World Model",
    body: values.join("; "),
  };
}

function deriveMoralTrack(flags) {
  const values = [];
  if (flags.has("MoralFlag")) values.push("moral realist");
  if (flags.has("MoralScepticFlag")) values.push("moral sceptic");
  if (flags.has("RelationalFlag")) values.push("relational justice");
  if (flags.has("EgalFlag")) values.push("egalitarian");
  if (flags.has("UtilFlag")) values.push("utilitarian");
  if (flags.has("NonConFlag")) values.push("non-consequentialist");
  if (flags.has("ConstructiveFlag")) values.push("constructive but self-critical");

  if (values.length === 0) {
    return null;
  }

  return {
    title: "Moral Track",
    body: values.join("; "),
  };
}

function deriveOutcome(flags) {
  const values = [];
  if (flags.has("ConstructiveEndFlag")) values.push("constructive ending");
  if (flags.has("DealStruckFlag")) values.push("deal with Milton");
  if (flags.has("RefusedOfferFlag")) values.push("offer refused");
  if (flags.has("KilledMiltonFlag")) values.push("Milton banished");

  if (values.length === 0) {
    return null;
  }

  return {
    title: "Outcome Markers",
    body: values.join("; "),
  };
}

function emptyState(text) {
  const div = document.createElement("div");
  div.className = "empty-state";
  div.textContent = text;
  return div;
}

function loadSavedState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn("Could not load saved state", error);
    return null;
  }
}

function persist() {
  if (!runtime) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(runtime.serialize()));
}
