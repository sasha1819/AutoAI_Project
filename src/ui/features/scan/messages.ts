import type { ChannelFailureCode } from "../../../contracts/channels.ts";
import type { ScanReport } from "../../../contracts/scan.ts";

export type ScanCode = ChannelFailureCode<"scan:run">;
export type WarningCode = ScanReport["warnings"][number]["code"];
export type StoppedCode = NonNullable<ScanReport["stoppedBy"]>["code"];

const CHOOSE_AGAIN =
  "AutoAI couldn't read your project. Go back, choose the folders again, then scan.";

/** Why the scan did not run, with what to do next. One entry per code in the contract (a missing one does not compile). */
export const SCAN_MESSAGE: Record<ScanCode, string> = {
  // Add project disables Scan without a key, so this means the key went away after Scan was pressed.
  NO_KEY: "Claude isn't connected any more. Connect Claude, then scan again.",
  SCAN_BUSY: "Another scan is already running. Wait for it to finish, then scan again.",
  FOLDER_NOT_PICKED: CHOOSE_AGAIN,
  PATH_NOT_FOUND: "Your project's folder isn't there any more. Go back and choose it again.",
  NOT_A_DIRECTORY: "That isn't a folder. Go back and choose your project's folder.",
  NOT_A_FILE: CHOOSE_AGAIN,
  PATH_UNREADABLE:
    "AutoAI isn't allowed to read some files in your project. Check its permissions, then scan again.",
  PATH_OUTSIDE_ROOT: CHOOSE_AGAIN,
  SECRET_STORE_UNAVAILABLE:
    "This computer can't read your saved key (no system keychain). Connect Claude again, then scan.",
  SECRET_STORE_FAILED: "Your saved key couldn't be read. Connect Claude again, then scan.",
};

/** What a finished scan reports without failing, said once per kind. */
export const WARNING_MESSAGE: Record<WarningCode, string> = {
  SOURCE_FILE_UNREADABLE: "Some source files couldn't be read and were skipped.",
  NO_PRD_FILES: "No PRDs were read, so nothing was compared with your code.",
  BATCH_NOT_SCANNED:
    "Claude couldn't give a valid answer for some areas. Their requirements are listed as not scanned.",
};

const TRY_LATER = "Claude couldn't finish the comparison. Try the scan again later.";

/** Why Claude stopped the comparison early (the findings before it are kept). */
export const STOPPED_MESSAGE: Record<StoppedCode, string> = {
  AI_AUTH_FAILED:
    "Anthropic didn't accept your key any more. Connect Claude with a working key, then scan again.",
  AI_RATE_LIMITED: "Anthropic is busy right now (rate limit). Wait a minute, then scan again.",
  AI_UNAVAILABLE: "Couldn't reach Anthropic. Check your internet connection, then scan again.",
  AI_MODEL_NOT_FOUND:
    "The Claude model AutoAI uses isn't available to your key. Check your model access in the Anthropic Console, then scan again.",
  AI_BAD_REQUEST: TRY_LATER,
  AI_REFUSED: TRY_LATER,
  AI_OUTPUT_TRUNCATED: TRY_LATER,
};
