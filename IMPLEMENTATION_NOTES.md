# Implementation Notes

## 1. What I changed

- **Bug 1 (diff):** `computeDiff` only compared `unitPrice`, so a quantity-only change showed as "unchanged". It now compares price and quantity.
- **Bug 2 (permission):** `canApprove` only checked the CR status. It now checks status AND the user's policy (`canApprovePolicy`). I did the same for `canReject`.
- **List:** added the status filter (`visibleRows`) and a "no results" message when a filter matches nothing.
- **Detail:** timeline sorted oldest first, reject reason is required, and Approve/Reject call the API.
- **Tests:** 30 tests in total, using the DOM.

## 2. Component & state model

**List (`CrListComponent`)**
- `state`: `loading`, `loaded`, `empty` or `error`. The template shows one block per state.
- `statusFilter`: the selected status. `visibleRows` is computed from `state.data` and `statusFilter`.

**Detail (`CrDetailComponent`)**
- `state`: the same view-state pattern. The data is the CR.
- `submitting`: true while an Approve/Reject call is running.
- `actionError`: the error message when an action fails.
- `rejectControl`: the reason box, with validators.
- `timeline`, `diff`, `canApprove` and `canReject` are getters computed from the state, so there is no hidden state.

**Data flow:** mock API -> `state` -> getters -> template. After a successful action, the CR returned by the API replaces `state`, so status, timeline and buttons update together.

## 3. Invariants I keep

| Invariant | How / where |
|---|---|
| Actions need the right status AND permission | `canApprove` / `canReject` check `PENDING_APPROVAL` and `canApprovePolicy`; `approve()` / `reject()` check them again |
| No double actions | `if (this.submitting) return;` at the start of each action, and the buttons are disabled while `submitting` |
| Reject needs a real reason | `Validators.required` + `/\S/` pattern; `reject()` stops if invalid; the Reject button is disabled |
| No stale or wrong view on failure | On error I only set `actionError`; the old CR stays on screen and the buttons come back (`finally`) |
| No optimistic update | The screen changes only after the API succeeds |
| Timeline is oldest first | `[...audit].sort(...)` on a copy, so the original data is not changed |
| The reason is kept on failure | `rejectControl.reset()` only runs on success |

## 4. Testing strategy

- **DOM component tests** (TestBed): they check what the user sees: rows, messages, disabled buttons, and the order of the timeline.
- **Unit tests** for `computeDiff`.
- I used `latencyMs` and `failNext` on the mock API for slow and failing calls, so there are no real delays.
- Covered: list states, filter and no-results, diff, totals and delta, timeline order, permissions, approve/reject success, slow calls and double click (API called once), failures, and reject validation.
- Skipped: formatting of dates, and reloading when `id` changes.

## 5. Assumptions

- **Approve and Reject are both hidden** for users without permission, or when the CR is not pending.
- The diff compares price and quantity only. A description-only change counts as "unchanged".
- Timeline dates are ISO strings in the same format, so I sort them as text.
- Reject sends the trimmed reason.

## 6. Where I used AI

I used Claude as a guide while working. It explained how to debug the two bugs, and helped me with the code for the filter, the timeline, `approve()` / `reject()`, and the tests. I ran everything, read every line, and I can explain and change it.

## 7. What I'd improve with more time

- The list does not refresh after an action. I would emit an event or use shared state.
- Reload the detail when `id` changes (`ngOnChanges`), and ignore old responses.
- Format dates and the list delta with currency.