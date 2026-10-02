import { CircleAlert, Info, X } from "lucide-react";
import { assertAccessibleName, type NonEmpty } from "../../accessibility/accessible-name.ts";
import { Badge } from "../Badge/index.ts";
import { IconButton } from "../IconButton/index.ts";

/** info: something finished or changed; it closes by itself. error: something failed; it stays until dismissed. */
export type ToastKind = "info" | "error";

export type ToastProps<Title extends string = string> = {
  readonly title: NonEmpty<Title>;
  readonly description?: string;
  readonly kind: ToastKind;
  readonly onDismiss: () => void;
};

// The card is neutral; only an error's icon is red (toast-error-icon, owned by this file). An error is also told by
// its icon shape and a visible "Error" tag (read out too), never by colour alone.
const ICON: Record<ToastKind, { readonly Icon: typeof Info; readonly tone: string }> = {
  info: { Icon: Info, tone: "text-text-primary" },
  error: { Icon: CircleAlert, tone: "text-toast-error-icon" },
};

/** One notification card. Screens do not render it: they call `useToast().show`, which also announces it. */
export function Toast<Title extends string>({
  title,
  description,
  kind,
  onDismiss,
}: ToastProps<Title>) {
  assertAccessibleName(title, "Toast");
  const { Icon, tone } = ICON[kind];
  const detail = description !== undefined && description.trim() !== "" ? description : undefined;
  return (
    <div className="flex w-80 items-start gap-3 rounded-card border border-border-strong bg-raised p-3 shadow-overlay">
      <Icon aria-hidden="true" className={`mt-0.5 size-4 shrink-0 ${tone}`} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="flex items-start gap-2 text-md font-medium text-text-primary">
          {kind === "error" && <Badge label="Error" uppercase />}
          <span className="min-w-0">{title}</span>
        </p>
        {detail !== undefined && <p className="text-sm text-text-secondary">{detail}</p>}
      </div>
      {/* Pulled into the padding so the 28px button centres on the first line of the title. */}
      <div className="-my-1 -mr-1">
        <IconButton label="Dismiss notification" icon={<X />} size="sm" onClick={onDismiss} />
      </div>
    </div>
  );
}
