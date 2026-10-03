import type { ChannelFailureCode } from "../../../contracts/channels.ts";

/** NO_PRD_FILES is not a failure on this screen: it is the "no PRD files here" state, with its own words. */
export type ReadPrdsCode = Exclude<ChannelFailureCode<"project:read-prds">, "NO_PRD_FILES">;

const CHOOSE_AGAIN = "AutoAI couldn't read this folder. Choose it again.";

/** Why a chosen PRD folder could not be read, with what to do next. One entry per code in the contract. */
export const READ_PRDS_MESSAGE: Record<ReadPrdsCode, string> = {
  FOLDER_NOT_PICKED: CHOOSE_AGAIN,
  PATH_NOT_FOUND: "This folder isn't there any more. Choose it again.",
  NOT_A_DIRECTORY: "That isn't a folder. Choose the folder that holds your PRDs.",
  NOT_A_FILE: CHOOSE_AGAIN,
  PATH_UNREADABLE:
    "AutoAI isn't allowed to read some files in this folder. Check its permissions, then choose it again.",
  PATH_OUTSIDE_ROOT:
    "A file in this folder links to somewhere outside it, so AutoAI didn't read it. Choose another folder.",
};

/** Why Scan is off on this screen: no key yet, or a saved key that cannot be read (ai:status's codes). */
export type KeyCode = ChannelFailureCode<"ai:status"> | "NO_KEY";

/**
 * Said beside the disabled Scan, with what to do next. NO_KEY is scan:run's code for "no key configured": Add
 * project disables Scan first, so the UI never gets that reply (the scan screen words it for a key that vanished).
 */
export const KEY_MESSAGE: Record<KeyCode, string> = {
  NO_KEY: "Connect Claude to scan.",
  SECRET_STORE_UNAVAILABLE:
    "This computer can't read your saved key (no system keychain). Connect Claude again to scan.",
  SECRET_STORE_FAILED: "Your saved key couldn't be read. Connect Claude again to scan.",
};

export const CHECKING_CONNECTION = "Checking your Claude connection…";
