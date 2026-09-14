# KV quantization and parameter sweep

L2 | REQUIREMENTS_FIRST | EPHEMERAL. CONFIRMED-AUTO: user requests editable KV quantization, common-value controls, and animated parameter increase/decrease.

Delta: add explicit KV format and sizing, metadata fraction and user-supplied conversion time; add preset buttons to numeric parameters; add bounded, pausable parameter sweep with visible history and fixed Roofline axes. Preserve original defaults at 16-bit/zero overhead, 1,000 outputs/request, batch behavior and pure model. No GitHub publication path changed.

KV contract (REQ-KV): baseline input is explicitly a 16-bit reference in decimal KB/token/sequence, including both K and V across all cached layers. Optional geometry computes that reference as 2 × cached layers × KV heads × head dimension × 2 bytes / 1000. Quantized bytes = reference × bits/16 × (1+metadata%/100). Metadata applies only below 16 bits. Conversion penalty is input microseconds per processed token/sequence, at fixed scenario context; applied only below 16 bits. It is an aggregate calibrated penalty, not a kernel model. No automatic quality or effective TOPS change. FP8 and INT8 share nominal capacity only. Uniform caches only; residual windows, mixed layer precisions, MLA and paged allocation are excluded.

Acceptance: 192 KB 16-bit -> 96 KB 8-bit -> 48 KB 4-bit without metadata; 10% metadata -> 105.6 KB at 8-bit. At 1000 us added conversion time, batch 1/P=512 gets +0.512s prefill and +0.999s decode versus the same quantized case with zero cost. Geometry 48×8×128 yields 196.608 KB/token at 16-bit. Errors must reject invalid active inputs without stale results.

Preset contract (REQ-QUICK): controls use the same validation/derived update path as typing. Common-value controls do not remove custom input or +/-1.

Sweep contract (REQ-SWEEP): choose parameter, preset/custom values, up/down direction and playback speed; Start/Pause/Resume/Restore baseline. Values are finite, within input bounds, integral for count parameters; at most 200 points. Each sample restores the same other-input baseline to prevent hit-floor mutation contaminating later cases. Manual edits/reset/modal/background pause or cancel playback as appropriate. Stop at endpoint; infeasible samples appear as gaps, never invented speed. Fixed planned bounds make point movements comparable. Reduced motion disables transitions, never starts playback automatically.

Implementation: concrete config + pure sweep utilities + existing pure model + DOM controller. DDD aggregate N/A: local, deterministic educational computation; no persistence transaction. Async proof boundary: deterministic fake timer drives visible controls and results, including single timer ownership and stop/resume. No telemetry: local status and testable state suffice.

Tasks: T1 numeric KV contracts (model.js/tests); T2 preset and sweep controls (config.js/sweep.js/app.js/index.html/styles.css/tests); T3 documentation, standalone build, package and save. Single implementation stream.

## Evidence and final behavior

| Sequence | Requirement | Exact check | Observed outcome |
| --- | --- | --- | --- |
| 1 | REQ-KV | `node --test tests/model.test.cjs` | 10 pass / 1 fail: 8-bit KV still 0.290112 GB instead of 0.145056 GB. |
| 2 | REQ-KV | Same command after model extension | 11 pass. Additional geometry/overhead/boundary cases were first-run green. |
| 3 | REQ-QUICK | `node --test tests/ui.test.cjs` | 4 pass / 1 fail: Batch 4 quick button absent. |
| 4 | REQ-QUICK | `npm test` after controls | 19 pass. |
| 5 | REQ-SWEEP | `node --test tests/sweep.test.cjs` | 1 fail: empty result instead of [.5,1,1.5,2]. |
| 6 | REQ-SWEEP | Same command after range logic | 2 pass. |
| 7 | REQ-SWEEP | `node --test tests/ui.test.cjs` | 5 pass / 1 fail: Sweep start control absent. |
| 8 | REQ-SWEEP | `npm test` after controller | 22 pass. |
| 9 | All | `npm test` after lifecycle/edge cases | 26 pass: 14 numerical, 2 range, 10 DOM. |

Timer tests cover pause/resume, single-owner restart, exact endpoints, hidden-tab pause, manual reset, common/custom/discrete values, allocation gaps and baseline preservation against the linked hit floor. Roofline domains are locked to all feasible planned samples.

Static HTML was inspected with WeasyPrint, which does not reproduce browser grid/flex/SVG layout accurately; no browser-rendering or device performance claim is made. UI interaction proof is the deterministic DOM harness. Quantized timing remains a model with explicitly supplied overhead, not measured backend acceleration.

Learning: linked input normalization can contaminate a descending sweep if the next sample reads the previous displayed hit rate. Each sample now uses an immutable baseline; the batch-down/hit-floor test prevents recurrence.
