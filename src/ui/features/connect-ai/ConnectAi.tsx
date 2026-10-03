import { type SubmitEvent, useEffect, useRef, useState } from "react";
import { AiMark } from "../../design-system/patterns/AiChip/index.ts";
import { CenteredPage } from "../../design-system/patterns/CenteredPage/index.ts";
import { StatusIcon } from "../../design-system/patterns/StatusPill/index.ts";
import { Button } from "../../design-system/primitives/Button/index.ts";
import { Card } from "../../design-system/primitives/Card/index.ts";
import { ArrowRight } from "../../design-system/primitives/Icon/index.ts";
import { Input } from "../../design-system/primitives/Input/index.ts";
import { LinkButton } from "../../design-system/primitives/LinkButton/index.ts";
import { Spinner } from "../../design-system/primitives/Spinner/index.ts";
import { type Connection, useConnectAi } from "./useConnectAi.ts";

export type ConnectAiViewProps = {
  readonly connection: Connection;
  readonly notice?: string | undefined;
  /** The key being typed. The field starts empty and never shows a saved key (there is no way to read one). */
  readonly keyText: string;
  readonly onKeyTextChange: (text: string) => void;
  /** The user asked to check and save the typed key. */
  readonly onSave: () => void;
  readonly saving: boolean;
  /** Why the last key was not saved: shown under the field, in words. (The service trims the key before checking.) */
  readonly error?: string | undefined;
  /** The user is replacing a connected key: the field shows again. */
  readonly replacing: boolean;
  readonly onReplace: () => void;
  readonly onCancelReplace: () => void;
  readonly onContinue: () => void;
  /** Opens the Anthropic Console in the browser, for someone without a key yet. */
  readonly onOpenConsole: () => void;
  /** Goes on to Add project without a key: AI actions stay disabled until Claude is connected. */
  readonly onSetUpLater: () => void;
};

/**
 * Connect Claude (PRD Flow 1 step 2; mockup 2's layout, with the BYOK key field it does not draw). One main action
 * at a time: "Check and save" while no key is connected, then "Continue". A rejected key shows its reason under
 * the field and nothing retries by itself.
 */
export function ConnectAiView(props: ConnectAiViewProps) {
  const { connection, notice, keyText, onKeyTextChange, onSave, saving, error, replacing } = props;
  const asking = connection === "missing" || replacing;
  const keyField = useRef<HTMLInputElement>(null);
  const continueButton = useRef<HTMLButtonElement>(null);
  const wasAsking = useRef(asking);
  // Focus follows the step, since the control that was used disappears each time: a rejected key returns to the
  // field (its error is read with it); Replace key opens the field and moves into it; once connected, Continue.
  useEffect(() => {
    if (error !== undefined) keyField.current?.focus();
  }, [error]);
  useEffect(() => {
    if (wasAsking.current && !asking) continueButton.current?.focus();
    if (!wasAsking.current && asking && connection === "connected") keyField.current?.focus();
    wasAsking.current = asking;
  }, [asking, connection]);

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!saving) onSave();
  };

  return (
    <CenteredPage>
      <h1 className="text-xl font-bold text-text-primary">Connect Claude</h1>
      <p className="mt-2 max-w-110 text-md text-text-secondary">
        AutoAI uses your own Anthropic API key. Claude reads the relevant parts of your repository
        and PRDs.
      </p>
      <form onSubmit={submit} className="mt-8 flex w-full max-w-100 flex-col items-center">
        <div className="w-full text-left">
          <Card>
            <div className="flex items-center gap-4">
              <AiMark decorative size="lg" />
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="text-md font-semibold text-text-primary">Claude</p>
                {/* Always on the page, so the change to "Connected" is announced. */}
                <p role="status" className="flex items-center gap-1.5 text-sm text-text-secondary">
                  {connection === "loading" ? (
                    <>
                      <Spinner decorative size="sm" />
                      Checking…
                    </>
                  ) : connection === "connected" ? (
                    // Still connected while replacing: the saved key keeps working until a new one is accepted.
                    <>
                      <StatusIcon status="passed" />
                      Connected
                    </>
                  ) : (
                    "Not connected"
                  )}
                </p>
              </div>
              {connection === "connected" && !replacing && (
                <div className="ml-auto">
                  <Button variant="ghost" size="sm" onClick={props.onReplace}>
                    Replace key
                  </Button>
                </div>
              )}
            </div>
            {asking && (
              <div className="mt-5">
                <Input
                  ref={keyField}
                  label="Anthropic API key"
                  type="password"
                  autoComplete="off"
                  // While it is checked, the text stays as checked: an error then sits next to the key it is about.
                  readOnly={saving}
                  spellCheck={false}
                  placeholder="sk-ant-…"
                  value={keyText}
                  onChange={(e) => {
                    onKeyTextChange(e.target.value);
                  }}
                  hint="Find it in your Anthropic Console, under API keys."
                  {...(error === undefined ? {} : { error })}
                />
              </div>
            )}
          </Card>
        </div>
        {/* Always on the page, so a notice that arrives after loading (an unreadable saved key) is announced. */}
        <div role="status" className="w-full">
          {notice !== undefined && <p className="mt-3 text-sm text-text-secondary">{notice}</p>}
        </div>
        {asking && (
          <p className="mt-6 text-sm text-text-secondary">
            Don't have a key?{" "}
            <LinkButton external onClick={props.onOpenConsole}>
              Create one in the Anthropic Console
            </LinkButton>
          </p>
        )}
        <p className="mt-6 max-w-104 text-sm text-text-muted">
          The key is checked with Anthropic, then stored encrypted by your system's keychain. It is
          only ever sent to Anthropic. API usage is billed by Anthropic, separately from any Claude
          Pro or Max subscription.
        </p>
        <div className="mt-8 flex gap-3">
          {asking ? (
            <>
              {replacing && (
                <Button
                  variant="secondary"
                  size="xl"
                  disabled={saving}
                  onClick={props.onCancelReplace}
                >
                  Cancel
                </Button>
              )}
              {!replacing && (
                <Button
                  variant="secondary"
                  size="xl"
                  disabled={saving}
                  onClick={props.onSetUpLater}
                >
                  Set up later
                </Button>
              )}
              <Button size="xl" type="submit" loading={saving} disabled={keyText.trim() === ""}>
                Check and save
              </Button>
            </>
          ) : connection === "connected" ? (
            <Button
              ref={continueButton}
              size="xl"
              trailingIcon={ArrowRight}
              onClick={props.onContinue}
            >
              Continue
            </Button>
          ) : null}
        </div>
      </form>
    </CenteredPage>
  );
}

/** The Connect AI screen: its hook and its view. The typed key lives only here, and is cleared once saved. */
export function ConnectAi({
  onContinue,
  onSetUpLater,
}: {
  readonly onContinue: () => void;
  readonly onSetUpLater: () => void;
}) {
  const ai = useConnectAi();
  const [keyText, setKeyText] = useState("");
  const [replacing, setReplacing] = useState(false);
  return (
    <ConnectAiView
      connection={ai.connection}
      notice={ai.notice}
      keyText={keyText}
      onKeyTextChange={setKeyText}
      onSave={() => {
        void ai.save(keyText).then((saved) => {
          if (saved) {
            setKeyText("");
            setReplacing(false);
          }
        });
      }}
      saving={ai.saving}
      error={ai.error}
      replacing={replacing}
      onReplace={() => {
        ai.clearError();
        setReplacing(true);
      }}
      onCancelReplace={() => {
        ai.clearError();
        setKeyText("");
        setReplacing(false);
      }}
      onContinue={onContinue}
      onOpenConsole={ai.openConsole}
      onSetUpLater={onSetUpLater}
    />
  );
}
