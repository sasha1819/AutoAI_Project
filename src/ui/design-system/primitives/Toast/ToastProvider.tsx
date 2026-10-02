import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { assertAccessibleName, type NonEmpty } from "../../accessibility/accessible-name.ts";
import { Toast, type ToastKind } from "./Toast.tsx";

export type ToastInput<Title extends string = string> = {
  readonly title: NonEmpty<Title>;
  readonly description?: string;
  readonly kind?: ToastKind;
};

export type ToastApi = {
  /**
   * Shows and announces a notification; returns its id. An info toast closes by itself, so it must never be the only
   * place something is shown: the screen keeps the result visible too (a toast is a heads-up, not the record).
   */
  readonly show: <Title extends string>(toast: ToastInput<Title>) => number;
  readonly dismiss: (id: number) => void;
};

type Shown = {
  readonly id: number;
  readonly title: string;
  readonly description?: string;
  readonly kind: ToastKind;
};
type Spoken = { readonly id: number; readonly text: string };
type Timer = {
  handle: ReturnType<typeof setTimeout> | undefined;
  deadline: number;
  remaining: number;
};

/** How long an info toast stays: long enough to read two lines. A UI timing, so it lives here, not in core/rules. */
export const INFO_TOAST_MS = 6000;

const ToastContext = createContext<ToastApi | undefined>(undefined);

/** The toasts of the whole app: wrap the app once. F6 moves focus to the newest toast; Escape there dismisses it. */
export function ToastProvider({ children }: { readonly children: ReactNode }) {
  const [toasts, setToasts] = useState<readonly Shown[]>([]);
  // The newest message per live region only: a region re-read in full would repeat every message still open.
  const [spoken, setSpoken] = useState<{ readonly info?: Spoken; readonly error?: Spoken }>({});
  const nextId = useRef(1);
  const timers = useRef(new Map<number, Timer>());
  const hold = useRef({ hover: false, focus: false });
  const returnFocus = useRef<HTMLElement | null>(null);
  const pendingFocus = useRef<number | "return" | undefined>(undefined);
  const list = useRef<readonly Shown[]>([]);
  const section = useRef<HTMLElement>(null);

  const remove = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer?.handle !== undefined) clearTimeout(timer.handle);
    timers.current.delete(id);
    setToasts((all) => all.filter((t) => t.id !== id));
    setSpoken((s) => ({
      ...(s.info?.id === id ? {} : s.info && { info: s.info }),
      ...(s.error?.id === id ? {} : s.error && { error: s.error }),
    }));
  }, []);

  // Each info toast counts down its own time; pausing keeps what is left, so new toasts never extend old ones.
  const arm = useCallback(
    (id: number, ms: number) => {
      timers.current.set(id, {
        handle: setTimeout(() => {
          remove(id);
        }, ms),
        deadline: Date.now() + ms,
        remaining: ms,
      });
    },
    [remove],
  );
  const held = () => hold.current.hover || hold.current.focus;
  const setHold = (part: "hover" | "focus", on: boolean) => {
    const was = held();
    hold.current[part] = on;
    if (!was && held()) {
      for (const t of timers.current.values()) {
        if (t.handle !== undefined) clearTimeout(t.handle);
        t.handle = undefined;
        t.remaining = Math.max(0, t.deadline - Date.now());
      }
    } else if (was && !held()) {
      for (const [id, t] of timers.current) if (t.handle === undefined) arm(id, t.remaining);
    }
  };

  const show = useCallback(
    <Title extends string>({ title, description, kind = "info" }: ToastInput<Title>) => {
      // Checked here, so blank data fails where it was passed in, not later inside the toast list's render.
      assertAccessibleName(title, "Toast");
      const id = nextId.current++;
      setToasts((all) => [
        ...all,
        { id, title, kind, ...(description === undefined ? {} : { description }) },
      ]);
      const words =
        description === undefined || description.trim() === "" ? title : `${title}. ${description}`;
      setSpoken((s) => ({
        ...s,
        [kind]: { id, text: kind === "error" ? `Error: ${words}` : words },
      }));
      if (kind === "info") {
        if (hold.current.hover || hold.current.focus) {
          timers.current.set(id, { handle: undefined, deadline: 0, remaining: INFO_TOAST_MS });
        } else arm(id, INFO_TOAST_MS);
      }
      return id;
    },
    [arm],
  );
  const api = useMemo(() => ({ show, dismiss: remove }), [show, remove]);

  // Dismissed from the keyboard: focus goes to the next toast, else the previous, else back where it came from.
  const dismissByUser = (id: number) => {
    if (section.current?.contains(document.activeElement) === true) {
      const i = list.current.findIndex((t) => t.id === id);
      pendingFocus.current = (list.current[i + 1] ?? list.current[i - 1])?.id ?? "return";
    }
    remove(id);
  };
  const focusToast = (id: number) =>
    section.current?.querySelector<HTMLElement>(`[data-toast-id="${String(id)}"] button`)?.focus();

  useEffect(() => {
    list.current = toasts;
    const target = pendingFocus.current;
    pendingFocus.current = undefined;
    if (target === "return") returnFocus.current?.focus();
    else if (target !== undefined) focusToast(target);
    // An emptied list unmounts under the pointer or focus, so no leave or blur arrives: let go of the pause here.
    if (toasts.length === 0) hold.current = { hover: false, focus: false };
  }, [toasts]);

  useEffect(() => {
    const newest = toasts.at(-1);
    if (newest === undefined) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "F6" || section.current?.contains(document.activeElement) === true) return;
      e.preventDefault();
      returnFocus.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      focusToast(newest.id);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [toasts]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <>
          {/* Always on the page, so a message added later is announced. The cards below are not live (no double reading). */}
          <div role="status" aria-live="polite" className="sr-only">
            {spoken.info && <p key={spoken.info.id}>{spoken.info.text}</p>}
          </div>
          <div role="alert" aria-live="assertive" className="sr-only">
            {spoken.error && <p key={spoken.error.id}>{spoken.error.text}</p>}
          </div>
          {toasts.length > 0 && (
            <section
              ref={section}
              aria-label="Notifications"
              className="fixed right-4 bottom-4 z-50 flex flex-col gap-2"
              onMouseEnter={() => {
                setHold("hover", true);
              }}
              onMouseLeave={() => {
                setHold("hover", false);
              }}
              onFocus={(e) => {
                if (
                  !e.currentTarget.contains(e.relatedTarget) &&
                  e.relatedTarget instanceof HTMLElement
                ) {
                  returnFocus.current = e.relatedTarget;
                }
                setHold("focus", true);
              }}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) setHold("focus", false);
              }}
              onKeyDown={(e) => {
                const card =
                  e.target instanceof Element ? e.target.closest("[data-toast-id]") : null;
                if (e.key === "Escape" && card !== null)
                  dismissByUser(Number(card.getAttribute("data-toast-id")));
              }}
            >
              {toasts.map((t) => (
                <div key={t.id} data-toast-id={t.id}>
                  <Toast
                    title={t.title}
                    kind={t.kind}
                    onDismiss={() => {
                      dismissByUser(t.id);
                    }}
                    {...(t.description === undefined ? {} : { description: t.description })}
                  />
                </div>
              ))}
            </section>
          )}
        </>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

/** Shows notifications. Throws outside a ToastProvider: a toast that silently goes nowhere is a bug. */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (api === undefined) throw new Error("useToast needs a ToastProvider around the app");
  return api;
}
