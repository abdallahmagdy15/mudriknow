import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { ContextPreview } from "./components/ContextPreview";
import { OwlMascot, OwlState } from "./components/OwlMascot";
import { ChatInput } from "./components/ChatInput";
import { ResponseView } from "./components/ResponseView";
import { Markdown } from "./components/Markdown";
import { MessageCopyButton } from "./components/MessageCopyButton";
import { CollapsibleUserMessage } from "./components/CollapsibleUserMessage";
import { ResizeGrips } from "./components/ResizeGrips";
import { CopyIcon } from "./components/icons";
import { parseMessageContent } from "./utils/message-content";
import { ModelSettings } from "./settings/ModelSettings";
import { ContextPayload, Action } from "@shared/types";
import { t as translate, Lang } from "@shared/i18n";

const ChatInputOptions = React.lazy(() => import("./components/ChatInputOptions"));

declare global {
  interface Window {
    hoverbuddy: {
      onContext: (cb: (data: ContextPayload) => void) => void;
      sendPrompt: (prompt: string) => void;
      onStreamToken: (cb: (token: string) => void) => void;
      onStreamTextReset: (cb: () => void) => void;
      onStreamDone: (cb: () => void) => void;
      onStreamError: (cb: (payload: any) => void) => void;
      onToolUse: (cb: (event: any) => void) => void;
      onSessionReset: (cb: (data?: { hasImage?: boolean }) => void) => void;
      executeAction: (action: any) => void;
      onActionResult: (cb: (result: any) => void) => void;
      retryAction: (action: any) => void;
      dismiss: () => void;
      minimize: () => void;
      toggleMaximize: () => void;
  resizePanel: (width: number, height: number) => void;
  minimizeToTaskbar: () => void;
      windowMove: (deltaX: number, deltaY: number) => void;
      newSession: () => void;
      onFocusInput: (cb: () => void) => void;
      attachScreenshot: () => void;
      removeScreenshot: () => void;
      captureContext: () => void;
      releaseContext: () => void;
      onContextCaptured: (cb: (data: { captured: boolean }) => void) => void;
      onScreenshotAttached: (cb: (data: { attached: boolean; hasImage: boolean }) => void) => void;
      getConfig: () => Promise<any>;
      setConfig: (config: any) => Promise<any>;
      restoreSession: (sessionId?: string) => Promise<any>;
      onSessionHistory: (cb: (messages: any[]) => void) => void;
      getRecentChats: () => Promise<{ id: string; title: string; created: number }[]>;
      stopResponse: () => void;
      validateModel: (model: string) => Promise<{ valid: boolean; modelId?: string; error?: string; suggestions?: string[]; needsAuth?: boolean; provider?: string }>;
      saveApiKey: (provider: string, key: string, verify?: boolean) => Promise<{ ok: boolean; code?: string; error?: string; message?: string }>;
      removeModel: (modelId: string) => Promise<any>;
      // Stage B: model-connection UX (wrap OpenCode's own provider/auth machinery).
      listProviders: () => Promise<any[]>;
      listModels: (providerId: string) => Promise<any[]>;
      verifyKey: (providerId: string, key: string) => Promise<{ ok: boolean; category?: string; message?: string }>;
      removeApiKey: (providerId: string) => Promise<{ ok: boolean; error?: string }>;
      getModelEffortOptions: (modelId: string) => Promise<string[]>;
      onContextLoading: (cb: (loading: boolean) => void) => void;
      guideUserChoice: (option: string) => void;
      hidePanel: () => void;
      onGuideStateUpdate: (cb: (state: any) => void) => void;
      onAcrylicState: (cb: (data: { active: boolean }) => void) => void;
      openExternal: (url: string) => void;
    };
  }
}

interface Message {
  role: "user" | "assistant";
  content: string;
  toolUses: ToolUseEvent[];
  screenshotAttached?: boolean;
  timestamp?: number;
}

interface ToolUseEvent {
  tool: string;
  status: string;
  input?: Record<string, any>;
  output?: string;
}

interface ActionResultEntry {
  action: Action;
  result: { success: boolean; error?: string; output?: string };
}

/**
 * Threshold for inlining a stream-error string in the UI. Anything longer
 * (or non-string) is treated as "unexpected runtime detail the user doesn't
 * need to see" and replaced with a localized friendly message. The full
 * value still goes to the renderer console for debugging.
 */
const MAX_INLINE_ERROR_LEN = 120;

/**
 * Detect a message's reading direction from its CONTENT (not the app language).
 * The AI may reply in Arabic or English regardless of the UI lang; each message
 * should flip RTL/LTR based on which script dominates. Counts Arabic letters
 * vs Latin letters — Arabic-majority → RTL. Code blocks naturally push Latin up,
 * so a mostly-Arabic prose reply still wins as RTL.
 */
function detectTextDir(text: string): "rtl" | "ltr" {
  if (!text) return "ltr";
  const arabic = (text.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g) || []).length;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  return arabic > latin ? "rtl" : "ltr";
}

export function App() {
  const [context, setContext] = useState<ContextPayload | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentResponse, setCurrentResponse] = useState("");
  const [actionResults, setActionResults] = useState<ActionResultEntry[]>([]);
  const [screenshotAttached, setScreenshotAttached] = useState(false);
  const [contextCaptured, setContextCaptured] = useState(false);
  const [contextSource, setContextSource] = useState<ContextPayload["source"]>(undefined);
  // Per-chip copied flag keyed by "<messageKey>::<segmentIndex>" so that
  // clicking one chip never highlights other chips that happen to have the
  // same text content. Cleared after 1.5s.
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [recentChatsOpen, setRecentChatsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [recentChats, setRecentChats] = useState<{ id: string; title: string; created: number }[]>([]);
  const [recentChatsLoading, setRecentChatsLoading] = useState(false);
  const [recentChatsPage, setRecentChatsPage] = useState(1);
  const [actionsEnabled, setActionsEnabled] = useState(true);
  const [currentModel, setCurrentModel] = useState("ollama-cloud/gemini-3-flash-preview");
  const [recentModels, setRecentModels] = useState<string[]>(["ollama-cloud/gemini-3-flash-preview"]);
  const [modelVariant, setModelVariant] = useState("");
  /** Supported reasoning-effort variants for the current model (e.g. ["low","medium","high"]).
   *  Empty → variant selector hidden. Fetched from the catalog on model switch. */
  const [effortOptions, setEffortOptions] = useState<string[]>([]);
  // Stage C: model-connection UX state.
  const [hasConfiguredModel, setHasConfiguredModel] = useState(false);
  const [currentProviderConnected, setCurrentProviderConnected] = useState<boolean | null>(null);
  const [authBanner, setAuthBanner] = useState<{ category: string; message: string; provider?: string } | null>(null);
  /** Briefly true after opening settings via the banner/health-check — pulses
   *  the "Add a model" button so the user's eye lands on the next action. */
  const [highlightAddModel, setHighlightAddModel] = useState(false);
  // Collapsible settings groups. Model + Hotkeys default closed (rarely touched
  // once configured); Appearance + Behavior default open (quick tweaks).
  const [openSections, setOpenSections] = useState<{ model: boolean; hotkeys: boolean; appearance: boolean; behavior: boolean }>({
    model: false,
    hotkeys: false,
    appearance: true,
    behavior: true,
  });
  const toggleSection = useCallback((key: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  /** Fetch the current model's provider auth status from the main process.
   *  Drives the chat banner + the "chat disabled until connected" gate. */
  const refreshConnectionState = useCallback(async (model?: string): Promise<boolean> => {
    const m = model || currentModel;
    try {
      const providers = await window.hoverbuddy.listProviders();
      const pid = m.split("/")[0];
      const me = (providers || []).find((p: any) => p.id === pid);
      const connected = !!(me && me.authenticated);
      setCurrentProviderConnected(connected);
      return connected;
    } catch {
      setCurrentProviderConnected(null);
      return false;
    }
  }, [currentModel]);
  const [restoringSession, setRestoringSession] = useState(false);
  const [hotkeyPointer, setHotkeyPointer] = useState("Alt+Space");
  const [hotkeyArea, setHotkeyArea] = useState("CommandOrControl+Space");
  const [hotkeyQuick, setHotkeyQuick] = useState("Alt+X");
  const [hotkeyError, setHotkeyError] = useState<string | null>(null);
  const [launchOnStartup, setLaunchOnStartup] = useState(false);
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
  const [lang, setLang] = useState<Lang>("en");
  const t = useCallback((key: any) => translate(lang, key), [lang]);
  // Mirror `lang` to localStorage so ErrorBoundary — which renders outside
  // of React state when App crashes — can still pick the right direction
  // + strings for the crash screen.
  useEffect(() => {
    try { localStorage.setItem("mudrik-lang", lang); } catch {}
  }, [lang]);

  // Sync data-theme attribute for CSS theme switching
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.setAttribute("data-theme", "dark");
    } else if (theme === "light") {
      root.removeAttribute("data-theme");
    } else {
      // system
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      root.setAttribute("data-theme", mq.matches ? "dark" : "");
      const handler = (e: MediaQueryListEvent) => {
        root.setAttribute("data-theme", e.matches ? "dark" : "");
      };
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [theme]);

  // Acrylic state: when Windows disables transparency effects (manual
  // toggle, battery saver, high-contrast mode, RDP/VM), the native acrylic
  // blur behind our translucent --bg-panel disappears and the panel looks
  // broken (solid black or see-through). Main process detects this and
  // pushes the active state; we reflect it as data-acrylic on <html> so
  // themes.css can swap --bg-panel back to opaque. Default is "on" until
  // we hear otherwise, so first paint matches the v1.12.5 frosted look.
  useEffect(() => {
    window.hoverbuddy.onAcrylicState((data) => {
      if (data.active) {
        document.documentElement.removeAttribute("data-acrylic");
      } else {
        document.documentElement.setAttribute("data-acrylic", "off");
      }
    });
  }, []);

  // Close settings dropdown on click outside. Mousedown (not click) so we
  // intercept before any focus shift that could swallow a click on the
  // dropdown itself. The settings gear and dropdown both opt out via their
  // class names — clicking either keeps the panel open.
  useEffect(() => {
    if (!settingsOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target) return;
      if (target.closest(".settings-panel") || target.closest(".btn-settings")) return;
      setSettingsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [settingsOpen]);

  // When settings closes, re-check the current provider's connection — the
  // user may have just saved/removed a key, which flips the banner + the
  // chat-disabled gate.
  useEffect(() => {
    if (!settingsOpen) void refreshConnectionState();
  }, [settingsOpen, refreshConnectionState]);

  // Close recent chats popup on click outside
  useEffect(() => {
    if (!recentChatsOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target) return;
      if (target.closest(".recent-chats-popup") || target.closest(".btn-recent-chats")) return;
      setRecentChatsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [recentChatsOpen]);
  const [fontSize, setFontSize] = useState(14);
  const [restoreSessionOnActivate, setRestoreSessionOnActivate] = useState(true);
  const [autoGuideEnabled, setAutoGuideEnabled] = useState(false);
  const [guideState, setGuideState] = useState<any | null>(null);
  // Mirror guideState into a ref so the main mount-effect's closures
  // (onContext, onStreamDone, etc.) can read the latest phase without
  // re-subscribing each render.
  const guideStateRef = useRef<any | null>(null);
  useEffect(() => { guideStateRef.current = guideState; }, [guideState]);
  const restoreSessionRef = useRef(true);
  const configLoadedRef = useRef(false);
  const chatInputRef = useRef<{ focus: () => void }>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const quickChatDismissedRef = useRef(false);
  const [quickChatDismissed, setQuickChatDismissed] = useState(false);
  // Last prompt the user sent — powers the Retry button on error. Stored in a
  // ref (not state) because it never needs to trigger a re-render on its own.
  const lastPromptRef = useRef<string>("");

  useEffect(() => {
    if (!window.hoverbuddy) {
      console.log("[RENDERER] ERROR: window.hoverbuddy is undefined!");
      return;
    }

    window.hoverbuddy.onContextLoading((loading) => {
      console.log(`[RENDERER] contextLoading: ${loading}`);
      setContextLoading(loading);
    });

    window.hoverbuddy.onContext((data) => {
      console.log(`[RENDERER] onContext: element type="${data.element?.type}" name="${data.element?.name}" source="${data.source}"`);
      // During an active guide, the panel may be re-shown by the main process
      // (e.g. step_finish auto-show). Treat that as a no-op for chat state —
      // the user is mid-walkthrough and resetting messages/streaming would
      // destroy the conversation flow they're trying to follow.
      if (guideStateRef.current && guideStateRef.current.phase !== "idle") {
        console.log("[RENDERER] onContext during active guide — preserving chat state");
        setContext(data);
        return;
      }
      setContext(data);
      setContextSource(data.source);
      setContextCaptured(data.source !== "quick" && data.element?.type !== "none");
      setActionResults([]);
      setCurrentResponse("");
      setStreaming(false);
      setError(null);
      setScreenshotAttached(!!data.hasScreenshot);
      setSettingsOpen(false);
      setMessages((prev) => {
        if (!configLoadedRef.current) {
          console.log("[RENDERER] Config not loaded yet — starting clean, will respect config on next activation");
          return [];
        }
        if (!restoreSessionRef.current) {
          console.log("[RENDERER] Restore disabled — starting clean");
          return [];
        }
        if (prev.length > 0) {
          console.log("[RENDERER] Restore enabled + active session — keeping messages");
          return prev;
        }
        console.log("[RENDERER] Fresh activation — restoring session");
        setRestoringSession(true);
        window.hoverbuddy.restoreSession().finally(() => setRestoringSession(false));
        return [];
      });
      setTimeout(() => chatInputRef.current?.focus(), 150);
    });

    window.hoverbuddy.onStreamToken((token) => {
      setCurrentResponse((prev) => prev + token);
    });

    // Main process tells us to wipe the streamed text — happens when the
    // AI starts a tool call mid-stream. Pre-tool text is "thinking out
    // loud" the model re-says after the tool result arrives. Without
    // this, models that loop through several text→tool→text cycles
    // dump a wall of duplicated preamble into the chat.
    window.hoverbuddy.onStreamTextReset(() => {
      setCurrentResponse("");
    });

    window.hoverbuddy.onStreamDone(() => {
      console.log("[RENDERER] Stream done");
      setStreaming(false);
      setCurrentResponse((prev) => {
        if (prev.trim()) {
          setMessages((msgs) => [
            ...msgs,
            { role: "assistant", content: prev, toolUses: [], timestamp: Date.now() },
          ]);
        }
        return "";
      });
    });

    window.hoverbuddy.onStreamError((raw) => {
      // STREAM_ERROR now carries a structured payload {category, message,
      // provider?, recoveryAction}. Auth/quota errors also raise the chat
      // banner so the user gets a one-click "Fix in Settings" path.
      const p = (raw && typeof raw === "object" && "message" in raw)
        ? raw as { category: string; message: string; provider?: string; recoveryAction: string }
        : { category: "UNKNOWN", message: typeof raw === "string" ? raw : "", recoveryAction: "none" };
      console.log(`[RENDERER] Stream error (${p.category}): ${p.message}`);
      setStreaming(false);
      setError(p.message || t("somethingWentWrong"));
      if (p.recoveryAction === "openSettingsModel") {
        setAuthBanner({ category: p.category, message: p.message, provider: p.provider });
      }
    });

    window.hoverbuddy.onActionResult((result) => {
      console.log("[RENDERER] Action result:", result);
      setActionResults((prev) => [...prev, result as ActionResultEntry]);
    });

    window.hoverbuddy.onSessionReset((data) => {
      console.log(`[RENDERER] Session reset (hasImage=${data?.hasImage ?? false})`);
      setCurrentResponse("");
      setError(null);
      setActionResults([]);
      // Keep the screenshot badge when the server still has an image armed
      // for the next send (NEW_SESSION preserves pointer/area screenshots).
if (!data?.hasImage) {
        setScreenshotAttached(false);
      }
    });

    window.hoverbuddy.onScreenshotAttached((data) => {
      console.log(`[RENDERER] Screenshot attached: ${data.attached}, hasImage: ${data.hasImage}`);
      setScreenshotAttached(data.attached && data.hasImage);
    });

    window.hoverbuddy.onContextCaptured((data) => {
      console.log(`[RENDERER] Context captured: ${data.captured}`);
      setContextCaptured(data.captured);
      if (data.captured) {
        setContextSource("pointer");
      }
    });

    window.hoverbuddy.onSessionHistory((historyMessages: { role: string; content: string }[]) => {
      console.log(`[RENDERER] Session history: ${historyMessages.length} messages`);
      setRestoringSession(false);
      if (historyMessages.length > 0) {
        const mapped = historyMessages.map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          toolUses: [],
        }));
        setMessages((prev) => {
          if (prev.length === 0) return mapped;
          console.log(`[RENDERER] Merging ${mapped.length} history with ${prev.length} existing messages`);
          return [...mapped, ...prev];
        });
      }
    });

    window.hoverbuddy.onGuideStateUpdate((state: any) => {
      console.log(`[RENDERER] guide state: phase=${state?.phase} options=${JSON.stringify(state?.options || [])}`);
      if (!state || state.phase === "idle") {
        // Guide just ended. The AI is supposed to write a completion sentence
        // alongside guide_complete/guide_abort, but as a fallback (and so the
        // chat always carries a clear "guide ended" signal) we surface the
        // marker's summary/reason as an assistant message — but only if no
        // streamed AI text is currently sitting in currentResponse for this
        // turn (otherwise that AI text covers it and we'd duplicate).
        const finalMsg = state?.finalMessage;
        if (finalMsg) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: finalMsg, toolUses: [], timestamp: Date.now() },
          ]);
        }
        setStreaming(false);
        setGuideState(null);
      } else {
        setGuideState(state);
        // When a step becomes active, the AI is done streaming and is waiting
        // for user input. Reset streaming so the chat input is enabled —
        // critical for the "Else" button path where the panel opens mid-step
        // and the user needs to type a custom follow-up. Also fixes the case
        // where accepting the guide offer set streaming=true but the deferred
        // first step ran locally without a new stream to clear it.
        if (state.phase === "step-active") {
          setStreaming(false);
        }
      }
    });

    // Focus the chat input only when the user doesn't already have focus
    // in another field (settings inputs, hotkey capture, model picker).
    // Without this guard, any window-focus event steals focus away from
    // whatever input the user just clicked into.
    const focusChatIfIdle = () => {
      const ae = document.activeElement as HTMLElement | null;
      if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.tagName === "SELECT" || ae.isContentEditable)) {
        // User has something else focused. Respect it.
        return;
      }
      chatInputRef.current?.focus();
    };

    window.hoverbuddy.onFocusInput(() => {
      console.log("[RENDERER] Focus input requested");
      setTimeout(focusChatIfIdle, 50);
    });

    const handleWindowFocus = () => {
      setTimeout(focusChatIfIdle, 50);
    };
    window.addEventListener("focus", handleWindowFocus);

    window.hoverbuddy.getConfig().then((cfg: any) => {
      if (cfg?.actionsEnabled !== undefined) setActionsEnabled(cfg.actionsEnabled);
      if (cfg?.model) setCurrentModel(cfg.model);
      if (cfg?.recentModels) setRecentModels(cfg.recentModels);
      if (cfg?.hotkeyPointer) setHotkeyPointer(cfg.hotkeyPointer);
      if (cfg?.hotkeyArea) setHotkeyArea(cfg.hotkeyArea);
      if (cfg?.hotkeyQuick) setHotkeyQuick(cfg.hotkeyQuick);
      if (cfg?.launchOnStartup !== undefined) setLaunchOnStartup(cfg.launchOnStartup);
      if (cfg?.theme) setTheme(cfg.theme);
      if (cfg?.lang) setLang(cfg.lang);
      if (typeof cfg?.fontSize === "number") setFontSize(cfg.fontSize);
      if (cfg?.restoreSessionOnActivate !== undefined) {
        setRestoreSessionOnActivate(cfg.restoreSessionOnActivate);
        restoreSessionRef.current = cfg.restoreSessionOnActivate;
      }
      if (cfg?.showSplashOnStartup !== undefined) {
        // Legacy config field — no longer used; ignore.
      }
      if (cfg?.autoGuideEnabled !== undefined) setAutoGuideEnabled(cfg.autoGuideEnabled);
      if (cfg?.hasConfiguredModel !== undefined) setHasConfiguredModel(cfg.hasConfiguredModel);
      if (cfg?.modelVariant !== undefined) setModelVariant(cfg.modelVariant);
      configLoadedRef.current = true;
      // R4 health check: if first-run or the current model's provider isn't
      // connected, open the setup wizard so the user is never left in a
      // "can't send" state without guidance.
      const configured = !!cfg?.hasConfiguredModel;
      void refreshConnectionState(cfg.model).then((connected) => {
        if (!configured || !connected) openSettingsModel();
      });
    });
  }, []);

  // Push fontSize into the CSS custom property so every size-driven rule
  // in global.css (body, .message-content, .chat-input textarea) reacts
  // live without a refresh.
  useEffect(() => {
    const clamped = Math.max(11, Math.min(20, Math.round(fontSize)));
    document.documentElement.style.setProperty("--font-size-base", `${clamped}px`);
  }, [fontSize]);

  // Show Quick Chat hint when no context is captured and the user hasn't
  // sent a message or captured context yet.
  const hasSentMessageInQuickChat = quickChatDismissedRef.current || quickChatDismissed || messages.length > 0;
  const showQuickChatHint = (contextSource === "quick" || !contextCaptured) && !screenshotAttached && !hasSentMessageInQuickChat;

  // Header status label: Quick chat when no context, Watching when idle with
  // context, Thinking/Replying when the AI is working.
  const statusLabel = useMemo(() => {
    if (streaming) return t("thinking").replace("...", "");
    if (currentResponse) return "Replying";
    if (contextSource === "quick" || !contextCaptured) return t("quickChatMode");
    return "Watching";
  }, [streaming, currentResponse, contextSource, contextCaptured, t]);

  const statusPillClass = useMemo(() => {
    if (streaming || currentResponse) return "status-pill status-pill-active";
    if (contextSource === "quick" || !contextCaptured) return "status-pill status-pill-muted";
    return "status-pill";
  }, [streaming, currentResponse, contextSource, contextCaptured]);

  const handleSetFontSize = useCallback((size: number) => {
    const clamped = Math.max(11, Math.min(20, Math.round(size)));
    setFontSize(clamped);
    window.hoverbuddy.setConfig({ fontSize: clamped });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentResponse, actionResults]);

  // Escape, captured at the window so focus state doesn't matter. Priority:
  //   1. Active guide (UI visible)  → cancel the guide
  //   2. Model still streaming      → stop the response
  //   3. Otherwise                  → dismiss the panel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (guideState && guideState.options) {
        window.hoverbuddy.guideUserChoice("Cancel");
        e.preventDefault();
        return;
      }
      if (streaming) {
        window.hoverbuddy.stopResponse();
        e.preventDefault();
        return;
      }
      window.hoverbuddy.dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [streaming, guideState]);

  const handleSubmit = useCallback((prompt: string) => {
    console.log(`[RENDERER] Submit prompt: "${prompt}"`);
    // Defense guard: if the current provider isn't connected, route to the
    // wizard instead of sending (the chat input is also disabled in this case).
    if (currentProviderConnected === false) {
      openSettingsModel();
      return;
    }
    setAuthBanner(null);
    // During an active guide step, user's typed text is a custom guide
    // choice (they chose "Something else…" to type freely). Route through
    // guideUserChoice so the guide controller handles the recapture.
    if (guideStateRef.current && guideStateRef.current.phase === "step-active") {
      setMessages((prev) => [...prev, { role: "user" as const, content: prompt, toolUses: [], timestamp: Date.now() }]);
      setStreaming(true);
      window.hoverbuddy.guideUserChoice(prompt);
      return;
    }
    lastPromptRef.current = prompt;
    setMessages((prev) => [...prev, { role: "user" as const, content: prompt, toolUses: [], screenshotAttached: screenshotAttached, timestamp: Date.now() }]);
    quickChatDismissedRef.current = true;
    setCurrentResponse("");
    setError(null);
    setStreaming(true);
    setActionResults([]);
    setScreenshotAttached(false);
    window.hoverbuddy.sendPrompt(prompt);
  }, [screenshotAttached, currentProviderConnected]);

  const handleRetry = useCallback(() => {
    const prompt = lastPromptRef.current;
    if (!prompt || streaming) return;
    console.log(`[RENDERER] Retry: re-sending "${prompt}"`);
    setError(null);
    setAuthBanner(null);
    setCurrentResponse("");
    setActionResults([]);
    setStreaming(true);
    window.hoverbuddy.sendPrompt(prompt);
  }, [streaming]);

  const handleNewSession = useCallback(() => {
    console.log("[RENDERER] New session — preserving prompt/context/image");
    // Clear the conversation but leave screenshotAttached alone: the main
    // process replies via onSessionReset with { hasImage } which drives the
    // badge. The ChatInput keeps its own text state, so the typed prompt
    // survives unless/until the user presses Enter.
    window.hoverbuddy.newSession();
    setMessages([]);
    setCurrentResponse("");
    setError(null);
    setActionResults([]);
    setStreaming(false);
  }, []);

  const handleAttachScreenshot = useCallback(() => {
    console.log("[RENDERER] Attach screenshot clicked");
    window.hoverbuddy.attachScreenshot();
  }, []);

  const handleRemoveScreenshot = useCallback(() => {
    console.log("[RENDERER] Remove screenshot clicked");
    window.hoverbuddy.removeScreenshot();
    setScreenshotAttached(false);
    setMessages([]);
    setCurrentResponse("");
    setError(null);
    setActionResults([]);
    setStreaming(false);
  }, []);

  const handleCaptureContext = useCallback(() => {
    console.log("[RENDERER] Capture context clicked");
    quickChatDismissedRef.current = false;
    window.hoverbuddy.captureContext();
  }, []);

  const handleReleaseContext = useCallback(() => {
    console.log("[RENDERER] Release context clicked");
    quickChatDismissedRef.current = false;
    window.hoverbuddy.releaseContext();
    setContextCaptured(false);
    setContextSource(undefined);
    setScreenshotAttached(false);
  }, []);

  // Composer Capture pill — always captures/refreshes context. A separate
  // × button (rendered when context is held) handles release.

  const handleStopResponse = useCallback(() => {
    console.log("[RENDERER] Stop response clicked");
    window.hoverbuddy.stopResponse();
    setStreaming(false);
    if (currentResponse.trim()) {
      setMessages((msgs) => [
        ...msgs,
        { role: "assistant", content: currentResponse + "\n\n*[Response stopped]*", toolUses: [], timestamp: Date.now() },
      ]);
      setCurrentResponse("");
    } else {
      setCurrentResponse("");
      setError(t("responseStopped"));
    }
  }, [currentResponse]);

  const handleDismiss = useCallback(() => {
    console.log("[RENDERER] Dismiss clicked");
    window.hoverbuddy.dismiss();
  }, []);

  const handleToggleMaximize = useCallback(() => {
    window.hoverbuddy.toggleMaximize();
    setIsMaximized((prev) => !prev);
  }, []);

  const handleToggleRecentChats = useCallback(() => {
    if (guideState && guideState.phase !== "idle") return;
    setRecentChatsOpen((prev) => {
      const opening = !prev;
      if (opening) {
        setRecentChatsPage(1);
        setRecentChatsLoading(true);
        window.hoverbuddy.getRecentChats().then((chats) => {
          setRecentChats(chats);
        }).catch((e) => {
          console.log("[RENDERER] Failed to load recent chats", e);
          setRecentChats([]);
        }).finally(() => {
          setRecentChatsLoading(false);
        });
      }
      return opening;
    });
  }, [guideState]);

  const handleRestoreChat = useCallback(async (sessionId: string) => {
    console.log(`[RENDERER] Restore chat: ${sessionId.slice(0, 30)}`);
    setRecentChatsOpen(false);
    setMessages([]);
    setCurrentResponse("");
    setError(null);
    setActionResults([]);
    setStreaming(false);
    setScreenshotAttached(false);
    lastPromptRef.current = "";
    setRestoringSession(true);
    try {
      await window.hoverbuddy.restoreSession(sessionId);
    } finally {
      setRestoringSession(false);
    }
  }, []);

  // Dragging is handled natively by Chromium via the CSS `-webkit-app-region:
  // drag` declaration on `.app-header`. No JS / IPC involved — it's smooth
  // at any framerate, which the previous per-mousemove IPC approach was not.

  const handleRetryAction = useCallback((action: Action) => {
    console.log(`[RENDERER] Retrying action: type=${action.type}`);
    window.hoverbuddy.retryAction(action);
  }, []);

  const copyToClipboard = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopyToast(label);
    setTimeout(() => setCopyToast(null), 2000);
  }, []);
  const handleCopyChip = useCallback((text: string) => copyToClipboard(text, "Copied to clipboard"), [copyToClipboard]);

  const handleToggleActionsEnabled = useCallback(() => {
    const newVal = !actionsEnabled;
    setActionsEnabled(newVal);
    window.hoverbuddy.setConfig({ actionsEnabled: newVal });
  }, [actionsEnabled]);

  const handleToggleLaunchOnStartup = useCallback(() => {
    const newVal = !launchOnStartup;
    setLaunchOnStartup(newVal);
    window.hoverbuddy.setConfig({ launchOnStartup: newVal });
  }, [launchOnStartup]);

  const handleToggleRestoreSession = useCallback(() => {
    const newVal = !restoreSessionOnActivate;
    setRestoreSessionOnActivate(newVal);
    restoreSessionRef.current = newVal;
    window.hoverbuddy.setConfig({ restoreSessionOnActivate: newVal });
  }, [restoreSessionOnActivate]);

  const handleToggleAutoGuideEnabled = useCallback(() => {
    const newVal = !autoGuideEnabled;
    setAutoGuideEnabled(newVal);
    window.hoverbuddy.setConfig({ autoGuideEnabled: newVal });
  }, [autoGuideEnabled]);

  const handleSetTheme = useCallback((newTheme: "system" | "light" | "dark") => {
    setTheme(newTheme);
    window.hoverbuddy.setConfig({ theme: newTheme });
  }, []);

  const handleSetLang = useCallback((newLang: Lang) => {
    setLang(newLang);
    window.hoverbuddy.setConfig({ lang: newLang });
  }, []);

  const commitHotkeys = useCallback(async (pointer: string, area: string, quick: string) => {
    setHotkeyError(null);
    const cfg: any = await window.hoverbuddy.setConfig({ hotkeyPointer: pointer, hotkeyArea: area, hotkeyQuick: quick });
    if (cfg?.hotkeyPointer !== pointer || cfg?.hotkeyArea !== area || cfg?.hotkeyQuick !== quick) {
      setHotkeyError(t("hotkeyInUse"));
      if (cfg?.hotkeyPointer) setHotkeyPointer(cfg.hotkeyPointer);
      if (cfg?.hotkeyArea) setHotkeyArea(cfg.hotkeyArea);
      if (cfg?.hotkeyQuick) setHotkeyQuick(cfg.hotkeyQuick);
    }
  }, []);

  /** Fetch the supported reasoning-effort variants for the given model id.
   *  If the model has none, the composer's variant selector is hidden. */
  const refreshEffortOptions = useCallback(async (modelId: string) => {
    try {
      const opts = await window.hoverbuddy.getModelEffortOptions(modelId);
      const arr = Array.isArray(opts) && opts.length ? opts : [];
      setEffortOptions(arr);
      // If the current variant isn't in the new set, reset to default.
      if (arr.length && modelVariant && !arr.includes(modelVariant)) {
        setModelVariant("");
      }
    } catch { setEffortOptions([]); }
  }, [modelVariant]);

  // Refresh the available variant buttons whenever the current model changes.
  useEffect(() => { void refreshEffortOptions(currentModel); }, [currentModel, refreshEffortOptions]);

  const handleSwitchModel = useCallback((model: string) => {
    console.log(`[RENDERER] Switching model to: ${model}`);
    setCurrentModel(model);
    setAuthBanner(null);
    // Manually picking a model (via settings) counts as completing setup.
    if (!hasConfiguredModel) {
      window.hoverbuddy.setConfig({ hasConfiguredModel: true });
      setHasConfiguredModel(true);
    }
    window.hoverbuddy.setConfig({ model }).then((cfg: any) => {
      if (cfg?.recentModels) setRecentModels(cfg.recentModels);
      if (cfg?.model) setCurrentModel(cfg.model);
      void refreshConnectionState(cfg?.model || model);
    });
  }, [refreshConnectionState, hasConfiguredModel]);

  /**
   * Remove a model from the recent list. Main-process handler picks the
   * next recent as the new active model if the removed entry was current.
   * The caller (ModelSettings) is responsible for guarding against emptying
   * the list and for stopping event propagation.
   */
  /** Open settings expanded to the Model section + pulse the "Add a model"
   *  button so the user's eye lands on the next action. Used by the banner
   *  (Fix in Settings / Set up) and the first-run health check — replaces the
   *  old standalone wizard, which just duplicated the settings flow. */
  const openSettingsModel = useCallback(() => {
    setAuthBanner(null);
    setOpenSections((s) => ({ ...s, model: true }));
    setSettingsOpen(true);
    setHighlightAddModel(true);
    setTimeout(() => setHighlightAddModel(false), 3200);
  }, []);

  /** Persist the selected reasoning-effort variant for the current model.
   *  Passed to OpenCode as `--variant` on the next send. */
  const handleVariantChange = useCallback((newVariant: string) => {
    setModelVariant(newVariant);
    window.hoverbuddy.setConfig({ modelVariant: newVariant });
  }, []);

  const handleRemoveModel = useCallback(async (modelToRemove: string) => {
    if (recentModels.length <= 1) return;
    const cfg = await window.hoverbuddy.removeModel(modelToRemove);
    if (cfg?.recentModels) setRecentModels(cfg.recentModels);
    if (cfg?.model) setCurrentModel(cfg.model);
  }, [recentModels.length]);

  // msgKey disambiguates chips across messages — e.g. two separate replies
  // can each have a <!--COPY_BEGIN-->...<!--COPY_END--> chip without sharing highlight state.
  const renderSegments = useCallback((content: string, _msgKey: string) => {
    const segments = parseMessageContent(content);
    return segments.map((seg, i) => {
      if (seg.type === "copy-chip") {
        const copyCard = (e: React.MouseEvent) => {
          const card = (e.currentTarget as HTMLElement).closest(".copy-card");
          const body = card?.querySelector(".copy-card-body") as HTMLElement | null;
          handleCopyChip(body?.innerText ?? "");
        };
        return (
          <div key={i} className="copy-card">
            <button className="copy-card-btn" title="Copy" onClick={copyCard}>
              <CopyIcon />
            </button>
            <div className="copy-card-body">
              <Markdown>{seg.content}</Markdown>
            </div>
          </div>
        );
      }
      return <Markdown key={i}>{seg.content}</Markdown>;
    });
  }, [handleCopyChip]);

  // Reset quick-chat dismissal on fresh activation so the hint shows again
  // when the panel opens in quick-chat mode.
  useEffect(() => {
    if (contextSource === "quick" && !contextCaptured) {
      quickChatDismissedRef.current = false;
    }
  }, [contextSource, contextCaptured]);

  return (
    <div className="app" dir={lang === "ar" ? "rtl" : "ltr"}>
      <ResizeGrips />
      <div className="app-header">
        <div className="app-brand">
          <OwlMascot
            state={streaming ? "thinking" : (currentResponse ? "replying" : "idle") as OwlState}
            size={32}
          />
          <span className="app-title">{t("appTitle")}</span>
          <span className={statusPillClass}>
            <span className="dot"></span>
            {statusLabel}
          </span>
        </div>
        <div className="header-actions">
          <button className="btn-icon btn-new-session" onClick={handleNewSession} title={`${t("startNewConversation")} (${t("newSession")})`}>
            <i className="fa-solid fa-plus"></i>
          </button>
          <button
            className="btn-icon btn-recent-chats"
            onClick={handleToggleRecentChats}
            title={t("recentChats")}
            disabled={guideState && guideState.phase !== "idle"}
          >
            <i className="fa-solid fa-clock-rotate-left"></i>
          </button>
          <button className="btn-icon btn-settings" onClick={() => setSettingsOpen(!settingsOpen)} title={t("settings")}>
            <i className="fa-solid fa-gear"></i>
          </button>
          <button className="btn-icon btn-minimize" onClick={() => window.hoverbuddy.minimizeToTaskbar()} title={t("minimize")}>
            <i className="fa-solid fa-window-minimize"></i>
          </button>
          <button className="btn-icon btn-maximize" onClick={handleToggleMaximize} title={isMaximized ? t("restore") : t("maximize")}>
            <i className={`fa-solid ${isMaximized ? "fa-window-restore" : "fa-window-maximize"}`}></i>
          </button>
          <button className="btn-icon btn-dismiss" onClick={handleDismiss} title={t("close")}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>
      {recentChatsOpen && (
        <div className="recent-chats-popup">
          <div className="recent-chats-header">
            <span className="recent-chats-title">{t("recentChats")}</span>
            <button className="recent-chats-close" onClick={() => setRecentChatsOpen(false)} title={t("close")}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div className="recent-chats-list">
            {recentChatsLoading ? (
              <div className="recent-chats-empty"><i className="fa-solid fa-circle-notch fa-spin"></i> {t("loadingHistory")}</div>
            ) : recentChats.length === 0 ? (
              <div className="recent-chats-empty">{t("noRecentChats")}</div>
            ) : (
              <>
                {recentChats.slice(0, recentChatsPage * 10).map((chat) => (
                  <button
                    key={chat.id}
                    className="recent-chat-item"
                    onClick={() => handleRestoreChat(chat.id)}
                  >
                    <span className="recent-chat-content">
                      <span className="recent-chat-title">{chat.title || t("newChat")}</span>
                      <span className="recent-chat-date">{new Date(chat.created).toLocaleString()}</span>
                    </span>
                    <span className="recent-chat-arrow"><i className="fa-solid fa-chevron-right"></i></span>
                  </button>
                ))}
                {recentChats.length > recentChatsPage * 10 && (
                  <button className="recent-chats-load-more" onClick={() => setRecentChatsPage((p) => p + 1)}>
                    {t("loadMore")}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
      {settingsOpen && (
        <div className="settings-panel">
          <div className="settings-panel-header">
            <button className="settings-back" onClick={() => setSettingsOpen(false)} title="Back">
              <i className="fa-solid fa-arrow-left"></i>
            </button>
            <span className="settings-panel-title">Settings</span>
          </div>
          <div className="settings-panel-body">
          <div className={`settings-section ${openSections.model ? "open" : "closed"}`}>
            <button
              type="button"
              className="settings-section-header"
              onClick={() => toggleSection("model")}
              aria-expanded={openSections.model}
            >
              <span className="settings-section-icon"><i className="fa-solid fa-brain"></i></span>
              <span className="settings-label">{t("model")}</span>
              <span className="settings-section-meta">{currentModel.split("/").pop()}</span>
              <span className={`settings-chevron ${openSections.model ? "open" : ""}`}><i className="fa-solid fa-chevron-down"></i></span>
            </button>
            {openSections.model && (
              <div className="settings-section-body">
                <ModelSettings
                  currentModel={currentModel}
                  recentModels={recentModels}
                  onSwitchModel={handleSwitchModel}
                  onRemoveModel={handleRemoveModel}
                  highlightAdd={highlightAddModel}
                  t={t}
                />
              </div>
            )}
          </div>
          <div className={`settings-section ${openSections.hotkeys ? "open" : "closed"}`}>
            <button
              type="button"
              className="settings-section-header"
              onClick={() => toggleSection("hotkeys")}
              aria-expanded={openSections.hotkeys}
            >
              <span className="settings-section-icon"><i className="fa-solid fa-keyboard"></i></span>
              <span className="settings-label">{t("hotkeys")}</span>
              <span className="settings-section-meta">{hotkeyPointer} · {hotkeyQuick}</span>
              <span className={`settings-chevron ${openSections.hotkeys ? "open" : ""}`}><i className="fa-solid fa-chevron-down"></i></span>
            </button>
            {openSections.hotkeys && (
              <div className="settings-section-body">
                <label className="hotkey-row">
                  <span>Pointer</span>
                  <input
                    className="hotkey-input"
                    type="text"
                    value={hotkeyPointer}
                    onChange={(e) => setHotkeyPointer(e.target.value)}
                    onBlur={() => { if (hotkeyPointer) commitHotkeys(hotkeyPointer, hotkeyArea, hotkeyQuick); }}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    placeholder="Alt+Space"
                  />
                </label>
                {/* Area Capture hotkey is disabled for redesign — UI hidden, config retained. */}
                <label className="hotkey-row">
                  <span>Quick Chat</span>
                  <input
                    className="hotkey-input"
                    type="text"
                    value={hotkeyQuick}
                    onChange={(e) => setHotkeyQuick(e.target.value)}
                    onBlur={() => { if (hotkeyQuick) commitHotkeys(hotkeyPointer, hotkeyArea, hotkeyQuick); }}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    placeholder="Alt+X"
                  />
                </label>
                {hotkeyError && <div className="model-error">{hotkeyError}</div>}
              </div>
            )}
          </div>
          <div className={`settings-section ${openSections.appearance ? "open" : "closed"}`}>
            <button
              type="button"
              className="settings-section-header"
              onClick={() => toggleSection("appearance")}
              aria-expanded={openSections.appearance}
            >
              <span className="settings-section-icon"><i className="fa-solid fa-palette"></i></span>
              <span className="settings-label">{t("appearance")}</span>
              <span className="settings-section-meta">{theme === "system" ? t("themeAuto") : theme === "light" ? t("themeLight") : t("themeDark")} · {fontSize}px</span>
              <span className={`settings-chevron ${openSections.appearance ? "open" : ""}`}><i className="fa-solid fa-chevron-down"></i></span>
            </button>
            {openSections.appearance && (
              <div className="settings-section-body">
                <div className="settings-sublabel">{t("theme")}</div>
                <div className="theme-picker">
                  {(["system", "light", "dark"] as const).map((th) => (
                    <button
                      key={th}
                      className={`theme-option ${theme === th ? "theme-active" : ""}`}
                      onClick={() => handleSetTheme(th)}
                    >
                      {th === "system" ? t("themeAuto") : th === "light" ? t("themeLight") : t("themeDark")}
                    </button>
                  ))}
                </div>
                <div className="settings-sublabel">{t("language")}</div>
                <div className="theme-picker">
                  {(["en", "ar"] as const).map((l) => (
                    <button
                      key={l}
                      className={`theme-option ${lang === l ? "theme-active" : ""}`}
                      onClick={() => handleSetLang(l)}
                    >
                      {l === "en" ? "EN" : "عربي"}
                    </button>
                  ))}
                </div>
                <div className="settings-sublabel">{t("fontSize")} <span className="settings-hint">{fontSize}px</span></div>
                <input
                  className="font-size-slider"
                  type="range"
                  min={11}
                  max={20}
                  step={1}
                  value={fontSize}
                  onChange={(e) => handleSetFontSize(Number(e.target.value))}
                />
              </div>
            )}
          </div>
          <div className={`settings-section ${openSections.behavior ? "open" : "closed"}`}>
            <button
              type="button"
              className="settings-section-header"
              onClick={() => toggleSection("behavior")}
              aria-expanded={openSections.behavior}
            >
              <span className="settings-section-icon"><i className="fa-solid fa-sliders"></i></span>
              <span className="settings-label">{t("behavior")}</span>
              <span className={`settings-chevron ${openSections.behavior ? "open" : ""}`}><i className="fa-solid fa-chevron-down"></i></span>
            </button>
            {openSections.behavior && (
              <div className="settings-section-body">
                <label className="settings-toggle" title={t("allowDesktopActionsHint")}>
                  <span>{t("allowDesktopActions")}</span>
                  <div className={`toggle-switch ${actionsEnabled ? "on" : ""}`} onClick={handleToggleActionsEnabled}>
                    <div className="toggle-knob" />
                  </div>
                </label>
                <label className="settings-toggle" title={t("enableAutoGuideHint")}>
                  <span>{t("enableAutoGuide")}</span>
                  <div className={`toggle-switch ${autoGuideEnabled ? "on" : ""}`} onClick={handleToggleAutoGuideEnabled}>
                    <div className="toggle-knob" />
                  </div>
                </label>
                <label className="settings-toggle">
                  <span>{t("launchOnStartup")}</span>
                  <div className={`toggle-switch ${launchOnStartup ? "on" : ""}`} onClick={handleToggleLaunchOnStartup}>
                    <div className="toggle-knob" />
                  </div>
                </label>
                <label className="settings-toggle">
                  <span>{t("restoreChatOnPopup")}</span>
                  <div className={`toggle-switch ${restoreSessionOnActivate ? "on" : ""}`} onClick={handleToggleRestoreSession}>
                    <div className="toggle-knob" />
                  </div>
                </label>
              </div>
            )}
          </div>
          </div>
        </div>
      )}
{/* Context capture UI now lives inside the floating composer (Capture pill).
          The raw element preview stays hidden from end users — the LLM receives
          it internally but the UI doesn't need to show it. */}
      <div className="chat-stage">
      {showQuickChatHint && (
        <div className="quick-chat-hint">
          <i className="fa-solid fa-circle-info"></i>
          <span><strong>{t("quickChatMode")}</strong> — {t("quickChatHint")}</span>
          <button className="quick-chat-hint-x" onClick={() => { quickChatDismissedRef.current = true; setQuickChatDismissed(true); }} title={t("cancel")}><i className="fa-solid fa-xmark"></i></button>
        </div>
      )}
      <div className="messages">
        {restoringSession && (
          <div className="session-restoring">{t("loadingHistory")}</div>
        )}
        {contextLoading && (
          <div className="loading-bar-container">
            <div className="loading-bar" />
            <div className="loading-text">Scanning screen…</div>
          </div>
        )}
        {!restoringSession && !contextLoading && messages.length === 0 && !currentResponse && (
          <div className="empty-state">
            <div className="owl-wrap">
              <OwlMascot state="idle" size={88} />
            </div>
            <div className="wordmark">{t("appTitle")}</div>
            <div className="hint">{t("startNewConversation")}</div>
            <div className="caps">
              <button className="cap-chip" onClick={() => {
                if (!autoGuideEnabled) handleToggleAutoGuideEnabled();
                handleSubmit("Guide me through this step by step");
              }}>
                <i className="fa-solid fa-route"></i> {t("chipGuide")}
              </button>
              <button className="cap-chip" onClick={() => {
                if (!contextCaptured) handleCaptureContext();
              }}>
                <i className="fa-solid fa-crosshairs"></i> {contextCaptured ? t("recapture") : t("chipCapture")}
              </button>
              <button className="cap-chip" onClick={() => {
                handleSubmit("Explain what this UI element does and how to use it");
              }}>
                <i className="fa-solid fa-lightbulb"></i> {t("chipExplain")}
              </button>
            </div>
          </div>
        )}
        {messages.filter(msg => msg.content.trim()).map((msg, i) => (
          <div key={i} className={`message message-${msg.role}`}>
            <div className="message-header">
              <div className="message-role">{msg.role === "user" ? t("you") : t("appTitle")}</div>
              {msg.timestamp && (
                <div className="message-timestamp">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>
            {msg.role === "user" ? (
              <CollapsibleUserMessage
                content={msg.content}
                onCopy={(text, label) => copyToClipboard(text, label === "md" ? "Copied markdown" : "Copied text")}
              />
            ) : (
              <>
                <div
                  className="message-content md"
                  dir={detectTextDir(msg.content)}
                >
                  {renderSegments(msg.content, `m${i}`)}
                </div>
                <MessageCopyButton
                  content={msg.content}
                  variant="ai"
                  onCopy={(text, label) => copyToClipboard(text, label === "md" ? "Copied markdown" : "Copied text")}
                />
              </>
            )}
            {streaming && !currentResponse && msg.role === "user" && i === messages.length - 1 && (
              <div className="loading-bar-container">
                <div className="loading-bar" />
                <div className="loading-text">{t("thinking")}</div>
                <button className="btn-stop" onClick={handleStopResponse}>{t("stop")}</button>
              </div>
            )}
          </div>
        ))}
        {currentResponse && (
          <div className="message message-assistant">
            <div className="message-role">{t("appTitle")}</div>
            <div className="message-content md" dir={detectTextDir(currentResponse)}>{renderSegments(currentResponse, "streaming")}</div>
            {streaming && <span className="cursor-blink">|</span>}
            {streaming && <button className="btn-stop-inline" onClick={handleStopResponse}>{t("stop")}</button>}
          </div>
        )}
        {actionResults.filter(ar => !ar.action.type.startsWith('guide_')).map((ar, i) => (
          <div key={`action-${i}`} className={`action-result ${ar.result.success ? "action-success" : "action-failed"}`}>
            <span className="action-result-label">{ar.action.type}{ar.action.selector ? `: ${ar.action.selector}` : ""}</span>
            <span className="action-result-status">{ar.result.success ? "OK" : "FAIL"}</span>
            {!ar.result.success && (
              <button className="btn-retry" onClick={() => handleRetryAction(ar.action)}>{t("retry")}</button>
            )}
            {ar.result.error && <div className="action-result-error">{ar.result.error}</div>}
            {ar.result.output && <div className="action-result-output">{ar.result.output.slice(0, 500)}</div>}
          </div>
        ))}
        {error && (
          <div className="response-error">
            <div className="response-error-msg">{error}</div>
            {lastPromptRef.current && (
              <button className="btn-retry-response" onClick={handleRetry} disabled={streaming}>
                {t("retry")}
              </button>
            )}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="floating-stack">
        {guideState && guideState.options && guideState.options.length > 0 && (
          <React.Suspense fallback={null}>
            <ChatInputOptions
              caption={guideState.caption || guideState.summary}
              stepIndex={guideState.stepIndex}
              estStepsLeft={guideState.estStepsLeft}
              options={guideState.options}
              cancelIndex={guideState.cancelIndex}
              onChoose={(opt) => {
                const isCancel = guideState.cancelIndex !== undefined && opt === guideState.options[guideState.cancelIndex];
                if (!isCancel) {
                  setMessages((prev) => [...prev, { role: "user", content: opt, toolUses: [], timestamp: Date.now() }]);
                  setStreaming(true);
                }
                window.hoverbuddy.guideUserChoice(opt);
              }}
            />
          </React.Suspense>
        )}
        {(() => {
          const chatDisabled = currentProviderConnected === false;
          return (
            <>
              {(chatDisabled || authBanner) && (
                <div className={`conn-banner${authBanner ? " conn-banner-err" : ""}`}>
                  <div className="conn-banner-msg">
                    <i className={`fa-solid ${authBanner ? "fa-triangle-exclamation" : "fa-plug-circle-exclamation"}`}></i>
                    {authBanner ? authBanner.message : t("modelNeedsKey")}
                  </div>
                  <button
                    type="button"
                    className="conn-banner-btn"
                    onClick={openSettingsModel}
                  >
                    {authBanner ? t("fixInSettings") : t("setUpBtn")}
                  </button>
                </div>
              )}
              <ChatInput
                ref={chatInputRef}
                onSubmit={handleSubmit}
                disabled={streaming || contextLoading || chatDisabled}
                disabledPlaceholder={chatDisabled ? t("connectToStart") : undefined}
                lang={lang}
                contextCaptured={contextCaptured}
                onCapture={handleCaptureContext}
                onRelease={handleReleaseContext}
                actionsEnabled={actionsEnabled}
                onToggleActions={handleToggleActionsEnabled}
                autoGuideEnabled={autoGuideEnabled}
                onToggleGuide={handleToggleAutoGuideEnabled}
                variant={modelVariant}
                effortOptions={effortOptions}
                onVariantChange={handleVariantChange}
              />
            </>
          );
        })(        )}
        </div>
      </div>
      {copyToast && (
        <div className="copy-toast">
          <i className="fa-solid fa-check"></i> {copyToast}
        </div>
      )}
    </div>
  );
}