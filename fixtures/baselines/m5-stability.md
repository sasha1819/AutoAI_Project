# Scan stability, 3 runs (2026-10-03)

Same fixtures, same model (claude-sonnet-5, default effort), with AI extraction (ADR 0008). Scored by the
scan-evaluator against `fixtures/expected-findings.json` without rescanning. Run 1 is `m5-extraction-scan-result.json`;
runs 2 and 3 are `m5-stability-run2.json` and `m5-stability-run3.json`.

| Run | Requirements (parsed + by Claude) | Found | Missed | False positives | Not-implemented correct | Uncited | Calls | Tokens in + out |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 7 (5 + 2) | 3/3 | 0 | 0 | 1/1 | 0 | 5 | 20,334 + 1,994 |
| 2 | 7 (5 + 2) | 3/3 | 0 | 0 | 1/1 | 0 | 5 | 20,334 + 2,035 |
| 3 | 8 (5 + 3) | 3/3 | 0 | 0 | 1/1 | 0 | 5 | 20,402 + 2,542 |

Every cited evidence snippet exists in its file within the cited lines (±2). No warnings, no stops, nothing needed
review or was dropped.

## Severity (identical in all 3 runs)

| Entry | Key | Runs 1–3 |
| --- | --- | --- |
| Cart 1.2 (mismatch) | medium | medium |
| Shipping 2.1 (mismatch) | high | medium (under-rated, consistently) |
| Account 3.1 (not implemented) | medium or high (range since 2026-10-03, see `severityWhy`) | high (accepted) |
| checkout.md:5 (mismatch, found by Claude) | medium | medium |

Every mismatch got medium in every run.

## Extraction variation

checkout.md line 6 holds two sentences. Runs 1 and 2 extracted 2 requirements (the cart-and-email rule as one, the
confirmation message); run 3 split the first sentence into "cart must have an item" (match) and "email must be valid"
(the planted mismatch), so it shows 8 requirements. The planted mismatch was found every time, but under
"Checkout (AI) 1" in runs 1–2 and "Checkout (AI) 2" in run 3, and in run 3 two requirements share one quote.
