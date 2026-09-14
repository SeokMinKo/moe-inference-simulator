# Numerical model and assumptions

All sizes are decimal GB, rates GB/s, parameters billions (B), and time seconds. One multiply-add counts as two operations. TOPS is an effective input at the user's chosen compute precision, independently of weight bits.

## Fixed synchronous batch

B = batch size, P = prompt tokens/request, N = 1000 outputs/request, k = active experts/layer/request, E = experts/layer, L = layers, M = parameters/expert in millions, q = weight bits. All requests arrive together and have equal lengths. No padding, queue formation, continuous scheduling, prefix sharing or expert load imbalance is simulated.

Unique expert union U per layer:

- Same set: U = k.
- Independent: U = ceil(E × [1 − (1 − k/E)^B]), capped at E. This derives the expectation by summing each expert's probability of being selected at least once, then rounds up. The model uses this one fixed cardinality each window; it does not sample the distribution or claim a worst-case bound.
- Maximum spread: U = min(E, Bk).

Per-token active parameters A = sharedB + LkM/1000. Total parameters T = sharedB + LEM/1000. Batch compute scales with BA, not with U: multiple requests may calculate with the same expert weights.

Expert union S = LUMq/8000 GB. Shared weights H = sharedB × q/8 GB. Weights fetched per batch decode step W = H + S: perfect reuse across the batch. KV bytes per sequence/token K = effectiveKVKB/1e6 GB, both K and V across all layers. Final KV = B(P+999)K. Total resident = H + cacheGB + finalKV + buffersGB. S must fit cacheGB, and resident must fit dramGB; infeasible allocations return null public throughput/TPOT fields and hide phase dots. Internal candidate timing values are diagnostic only when `feasible` is false.

BuffersGB must be manually budgeted for the entire batch, including predictor weights, activations and workspace. It does not automatically scale. KV geometry is separate from MoE geometry; update cached attention layers/heads/dimension, or the 16-bit reference, when architecture changes. Weight quantization metadata remains omitted. KV metadata can be supplied as a fraction of its payload.

## KV sizing and quantization

`kvMode=reference` interprets `kvKB` as the **16-bit** K+V reference, not the already-quantized size. `kvMode=geometry` derives reference KB = 2 × kvLayers × kvHeads × kvDim × 2 bytes / 1000. Use KV heads, not query heads, for GQA/MQA. Geometry is homogeneous across cached layers; cached attention-layer count is separate from MoE-layer count. MLA and sliding-window caches require a different model; use a manually calibrated reference cautiously.

FP16/BF16: 16 bits; FP8/INT8: 8 bits; INT4: 4 bits. Payload KB = reference KB × bits/16. Below 16 bits, metadata KB = payload KB × kvMetadataPct/100. Effective KB is their sum. Metadata defaults to zero, an ideal payload-only assumption. Actual allocation includes backend-specific scale/zero-point storage, paging/padding, residual higher-precision tokens or skipped layers; the latter effects are not simulated.

`kvExtraUs` is a user-supplied aggregate conversion penalty in microseconds per processed token per request, for the selected format and context. Below 16 bits, prefill extra = BP × kvExtraUs/10⁶ seconds and decode extra = 999B × kvExtraUs/10⁶. It approximates runtime conversion cost; it does not derive dequantization operations from attention dimensions/context. Metadata/extra-time inputs are inactive at 16 bits. Zero extra cost is an ideal assumption. Lower precision does not automatically increase hardware TOPS or change the invented quality proxy. FP8 and INT8 have equal nominal storage here, not interchangeable runtime behavior or accuracy.

Sources: [vLLM quantized KV cache](https://docs.vllm.ai/en/latest/features/quantization/quantized_kvcache/) explains formats/scales; [Hugging Face quantized cache](https://huggingface.co/docs/transformers/kv_cache#quantized-cache) documents storage and latency tradeoffs. The percentage/time inputs above are this simulator's approximations, not measured coefficients from those sources.

## Offloading and IFP

Usable DRAM bandwidth d = dramBW × dramUse/100. Effective delivery u = min(ufs, d). UFS means expert bytes delivered into their final cache location, including I/O overhead. The incoming write is counted once in elapsed time; DRAM destination bandwidth remains a limit.

At repick, miss bytes m = S(1 − effectiveHit/100). Effective hit = max(inputHit, 100 × max(0, 2 − E/U)). The overlap floor follows from two retained sets of cardinality U in a universe of E. The UI raises the hit input and flashes it when necessary. Initial miss m0 = S(1 − initialHit/100), independently of subsequent hit rate.

One predictor run/request costs predictorMs/1000 seconds. Batch predictor cost p = B × predictorMs/1000 assumes serialized runs; it is a conservative choice, not a measured predictor scaling curve. Repick pause = m/u + p. No compute/I/O overlap, prefetch, extra staging copy or decompression is modeled. A selected set stays fixed for the window. One initial set is used throughout prefill. W=1 still uses this project-specific IFP predictor and is not a benchmark for standard routing.

## Timing

Prefill time = KV prefill extra + max[2ABP/(1000 × prefillTops), (W + BPK)/d].

TTFT = startup + p + m0/u + prefill. Shared weights are already resident; this is not cold model loading. All requests observe this same batch TTFT. Startup is one shared initial delay.

Prefill yields the first output. For j = 1..999:

Decode step j = B × kvExtraUs/10⁶ (below 16 bits only) + max[2AB/(1000 × decodeTops), W/d] + B(P+j)K/d.

The KV term models attention memory traffic separately; it is not overlapped with linear-layer compute. This is a simplified combined read/write approximation. Attention-score FLOPs and prefill attention working traffic are omitted, so long-context estimates can be optimistic.

R = floor(999/window) repicks before outputs window+1, 2×window+1, etc. There is no repick after the last output. The final output is not fed back, so final KV has P+999 positions/request.

D = sum of 999 decode steps. F = R(m/u + p). Elapsed = TTFT + D + F.

- Aggregate TPS = 1000B/elapsed.
- Average TPS/request = 1000/elapsed.
- Aggregate decode-only TPS = 999B/(D+F).
- Mean TPOT/request = (D+F)/999. This includes repick spikes; it is not a tail percentile.
- UFS bytes/batch = m0 + Rm.

## TOPS Roofline

Counted decode Gops = 2AB × 999. Decode DRAM GB = 999W + BK[999P + 999×1000/2] + Rm. X is Gops/GB, numerically ops/byte. Blue Y = Gops/[1000(D+F)]. Initial loading and TTFT are excluded; predictor waits are included but predictor operations are not counted.

Counted prefill Gops = 2ABP. Prefill DRAM GB = W + BPK. Red X = Gops/GB, red Y = Gops/(1000 × prefill). Initial loading is outside this phase. Prefill lies on its idealized roof when conversion overhead is zero; supplied extra time moves its point below that roof.

Each effective hardware roof = min(phase TOPS, d × X/1000). Model and batch inputs change work/traffic/time and the dots, not fixed hardware ceilings. Auto-scaled axes may alter their pixel appearance. Phase-average dots are not measured kernel utilization.

## Quality proxy

Q = clamp(20 + 50[1 − exp(−T/20)] + 25[1 − exp(−A/5)] − penalty, 0, 100).

Penalty = 3 log2(min(window,1000)), or zero when k=E. The batch union reaching E does not remove the penalty: each individual request can still use only k experts. Batch itself never increases this score. This score is invented for teaching, not measured accuracy. More parameters do not guarantee better answers, and precision/task/predictor quality are not modeled.

## Reference basis

[How To Scale Your Model: Inference](https://jax-ml.github.io/scaling-book/inference/) motivates separating batched weight reuse, per-request KV and latency. [MoE-Lightning](https://arxiv.org/abs/2411.11217) motivates accounting for multiple memory tiers in offloaded batch inference. The simplified formulas above are this application's assumptions, not reproductions of either source's benchmark.
