# ADR 0001 — Pure core with ports and adapters; UI separated as a design system + thin features

Status: accepted

Context: solo build; the product value is the matching/decision logic; UI and AI providers will change (new models, mobile targets, private models).
Decision: logic in a pure `core`; use cases in `services`; technology behind ports in `adapters`; two composition roots (`cli`, `app/main`); UI in four tiers (tokens, primitives, patterns, features). Boundaries are enforced by dependency-cruiser and a token check in `verify`.
Consequences: a little more structure on day one; adding Appium, a private model, or a new screen does not touch core rules; core can be tested without network or disk.
