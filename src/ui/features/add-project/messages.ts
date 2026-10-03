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

export type ScanCode = ChannelFailureCode<"scan:run">;

const SCAN_AGAIN = "The scan couldn't read your project. Choose the folders again, then scan.";

/**
 * Why a scan cannot run, with what to do next. One entry per code in the contract (a missing code does not
 * compile). Today Add project shows NO_KEY and the two key-store codes beside its disabled Scan (so the UI never
 * reaches scan:run's NO_KEY). Plan: when the scan screen is built, this map moves into the shared ui/app layer (or
 * that feature) and Add project receives its sentence as a prop; features cannot import each other.
 */
export const SCAN_MESSAGE: Record<ScanCode, string> = {
  NO_KEY: "Connect Claude to scan.",
  SCAN_BUSY: "A scan is already running. Wait for it to finish.",
  FOLDER_NOT_PICKED: SCAN_AGAIN,
  PATH_NOT_FOUND: "Your project's folder isn't there any more. Choose it again.",
  NOT_A_DIRECTORY: "That isn't a folder. Choose your project's folder.",
  NOT_A_FILE: SCAN_AGAIN,
  PATH_UNREADABLE:
    "AutoAI isn't allowed to read some files in your project. Check its permissions, then scan again.",
  PATH_OUTSIDE_ROOT: SCAN_AGAIN,
  SECRET_STORE_UNAVAILABLE:
    "This computer can't read your saved key (no system keychain). Connect Claude again to scan.",
  SECRET_STORE_FAILED: "Your saved key couldn't be read. Connect Claude again to scan.",
};

export const CHECKING_CONNECTION = "Checking your Claude connection…";
