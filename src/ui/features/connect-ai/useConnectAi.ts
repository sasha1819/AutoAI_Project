import { useCallback, useEffect, useRef, useState } from "react";
import { ANTHROPIC_CONSOLE } from "../../../contracts/links.ts";
import { bridge } from "../../app/bridge.ts";
import { SAVE_KEY_MESSAGE, STATUS_MESSAGE } from "./messages.ts";

/** Whether Claude is connected: still asking, no usable key yet, or connected (a key that worked when saved). */
export type Connection = "loading" | "missing" | "connected";

export type ConnectAi = {
  readonly connection: Connection;
  /** Why the saved key could not be read, when that happened (the screen then asks for a key). */
  readonly notice: string | undefined;
  readonly saving: boolean;
  /** Why the last key was not saved, in words; cleared when the user tries again. */
  readonly error: string | undefined;
  /**
   * Checks the typed key with Anthropic and saves it only if it works (ADR 0007). Resolves true when saved. The key
   * is sent once and never comes back: no channel can read a saved key.
   */
  readonly save: (key: string) => Promise<boolean>;
  /** Forgets the last error (the user cancelled, or opened the field again). */
  readonly clearError: () => void;
  /** Opens the Anthropic Console in the user's browser (the one allowlisted address). */
  readonly openConsole: () => void;
};

// A reply that breaks its contract, or no preload: a bug, not an expected failure. The screen must not hang on it,
// so it says so plainly; the error itself is still reported (console), not swallowed.
const BROKEN = "Something went wrong inside AutoAI. Restart it and try again.";

/** The Connect AI screen's one hook: the only code here that talks to main. */
export function useConnectAi(): ConnectAi {
  const [connection, setConnection] = useState<Connection>("loading");
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let live = true;
    const ask = async () => {
      try {
        const reply = await bridge().invoke("ai:status", {});
        if (!live) return;
        if (reply.ok) setConnection(reply.value.configured ? "connected" : "missing");
        else {
          setNotice(STATUS_MESSAGE[reply.error.code]);
          setConnection("missing");
        }
      } catch (e) {
        // No preload, or a reply that broke its contract (a bug): reported, and the screen still moves on.
        console.error(e);
        if (!live) return;
        setNotice(BROKEN);
        setConnection("missing");
      }
    };
    void ask();
    return () => {
      live = false;
    };
  }, []);

  // Read inside save without making it change on every status change.
  const connected = useRef(false);
  connected.current = connection === "connected";

  const save = useCallback(async (key: string) => {
    setSaving(true);
    setError(undefined);
    try {
      const reply = await bridge().invoke("ai:save-key", { key });
      if (reply.ok) {
        // Replacing a key: the status line already said Connected, so say that the new key was saved.
        setNotice(connected.current ? "New key saved." : undefined);
        setConnection("connected");
        return true;
      }
      setError(SAVE_KEY_MESSAGE[reply.error.code]);
      return false;
    } catch (e) {
      console.error(e);
      setError(BROKEN);
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(undefined);
  }, []);

  const openConsole = useCallback(() => {
    const open = async () => {
      try {
        const reply = await bridge().invoke("link:open", { url: ANTHROPIC_CONSOLE });
        if (!reply.ok)
          setNotice("Couldn't open your browser. Go to console.anthropic.com to create a key.");
      } catch (e) {
        console.error(e);
        setNotice(BROKEN);
      }
    };
    void open();
  }, []);

  return { connection, notice, saving, error, save, clearError, openConsole };
}
