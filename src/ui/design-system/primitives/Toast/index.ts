// Screens get the provider and the hook only: a card rendered by hand would never be announced.
export type { ToastKind } from "./Toast.tsx";
export { type ToastApi, type ToastInput, ToastProvider, useToast } from "./ToastProvider.tsx";
