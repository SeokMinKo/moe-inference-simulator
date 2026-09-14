# Validation and scope record

Scope: L2, CONFIRMED-AUTO from the user's request to extract the simulator into a repository and add adjustable Batch. English app, original Batch=1 TOPS behavior preserved. No deployment or additional proposed feature is bundled into the implementation.

## Acceptance contract

REQ-1: standalone local HTML/JS with no runtime dependency.
REQ-2: synchronous batch scales total outputs, per-request work, KV and expert union; separate aggregate and per-request rates.
REQ-3: fixed hardware retains its data-coordinate roofs; phase dots use batch work and traffic.
REQ-4: invalid cache/DRAM allocations suppress throughput; missing/nonpositive/fractional batch is rejected; linked changes flash blue.
REQ-5: prepare a new GitHub repository and publish when an authenticated creation path exists.

Terms: Batch means concurrent requests, not prompt tokens. Active parameters are per token. Union is distinct weight storage across the batch. Cache hit is a supplied repick assumption. Numerical policy is the pure `simulateMoE` function; DOM adaptation lives in `app.js`.

Non-obvious decision: expose three expert-sharing scenarios rather than silently reuse every expert across requests. This keeps batch amortization assessable without claiming to simulate routing traces. No new framework, service or persistence abstraction was needed.

## Evidence

| Sequence | Requirement | Command | Outcome | Scope |
| --- | --- | --- | --- | --- |
| 1 | REQ-2 | `node --test moe-inference-simulator/tests/model.test.cjs` | 1 pass, 1 fail | Observed NEW_BEHAVIOR red: batch=4 still returned Batch=1 KV, 0.290112 instead of 1.160448 GB. Baseline characterization passed. |
| 2 | REQ-2 | Same command after batch model extension | 2 pass | KV scaling and rate contract green; Batch=1 retained. |
| 3 | REQ-2/3/4 | Same command after boundary coverage | 10 pass | First-run green for additional model boundaries; no invented red history. |
| 4 | REQ-1/2/3/4 | `npm test` in repository | 14 pass | 10 numerical + 4 DOM integration checks. |

Batch=1 reference: aggregate TPS 18.25632876; TTFT 1.561184 s. Tests include compute saturation, union bounds, memory infeasibility, repick hit floor, UFS response, unchanged quality with batch, TOPS ceilings, invalid fields, reset and controls.

DOM checks use linkedom, not a real rendering engine. No real-browser visual or performance test is claimed. Real device calibration remains future work.

Historical export limitation (before the user created the repository): the available authenticated GitHub connection identifies `SeokMinKo` and supports repository content operations, but exposes no new-repository creation operation. No authenticated GitHub CLI/token was available locally. The export contains source, tests, documentation, CI and a single-file app. No remote URL is claimed.

## Version 1.1 extension

KV precision, fast presets and parameter playback are documented and verified in [CHANGE-KV-SWEEP.md](CHANGE-KV-SWEEP.md). The original 14 checks remain covered; current coverage adds KV geometry/metadata/conversion cost and deterministic timer-driven sweep tests. The user subsequently created `SeokMinKo/moe-inference-simulator` and authorized uploading the prepared version. The historical creation limitation above no longer prevents publishing to that existing repository.
