(function () {
  // Read hotkeys from the main process via query string injected by splash-window.ts
  const params = new URLSearchParams(window.location.search);
  const pointer = params.get("pointer") || "Alt+Space";
  // Area Capture is disabled for redesign — splash shows Pointer + Quick only.
  const quick = params.get("quick") || "Alt+X";
  const lang = params.get("lang") || "en";

  const strings: Record<string, { tagline: string; status: string; shortcutLabels: string[] }> = {
    en: {
      tagline: "Running in the background. Call MudrikNow any time with a shortcut.",
      status: "Ready",
      shortcutLabels: ["Pointer", "Quick"],
    },
    ar: {
      tagline: "يعمل في الخلفية. استدعِ مدرك في أي وقت باستخدام اختصار.",
      status: "جاهز",
      shortcutLabels: ["مؤشر", "سريع"],
    },
  };

  const s = strings[lang] || strings.en;

  const taglineEl = document.getElementById("tagline");
  if (taglineEl) taglineEl.textContent = s.tagline;

  const statusEl = document.getElementById("status-text");
  if (statusEl) statusEl.textContent = s.status;

  const shortcutsEl = document.getElementById("shortcuts");
  if (shortcutsEl) {
    const combos = [pointer, quick];
    const displayCombos = combos.map((c) => c.replace("CommandOrControl", "Ctrl").replace("Command", "⌘"));
    shortcutsEl.innerHTML = s.shortcutLabels.map((label, i) =>
      `\u003cspan class="shortcut"\u003e\u003cspan class="dot"\u003e\u003c/span\u003e${displayCombos[i]}\u003c/span\u003e`
    ).join("");
  }

  // Click anywhere to dismiss
  document.getElementById("splash")?.addEventListener("click", () => {
    window.close();
  });
})();
