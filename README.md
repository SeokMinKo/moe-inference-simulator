# MoE Inference Simulator

An English, browser-based teaching simulator extracted from the original page-10 TOPS lab in **MoE on Edge — A Visual Guide**. Adjust batch size, KV precision, model shape, effective GPU/NPU TOPS, DRAM bandwidth/capacity, UFS delivery speed, expert cache hits and IFP repick windows.

**An analytical teaching estimate, not a benchmark or an accuracy predictor.**

## Run

Open `index.html` directly in a browser. No build, server, runtime package or network request is required. Alternatively run `npm start` (Python 3), then visit `http://localhost:8000`.

`moe-inference-simulator.html` is the generated single-file edition. Regenerate it with `node scripts/build.cjs` after editing the source.

## Batch behavior

Batch means concurrent, equal-length requests that arrive together. Every request produces 1,000 output tokens. This is a fixed synchronous batch; continuous batching and a request queue are not modeled.

| Result | Meaning |
| --- | --- |
| Aggregate TPS | Batch × 1,000 / elapsed seconds, including TTFT |
| Average TPS / request | 1,000 / elapsed seconds, including TTFT |
| TTFT / request | Shared initial delay + serialized predictors + initial expert loading + batched prefill |
| Mean TPOT / request | Decode and repick time / 999 decode iterations |
| Aggregate decode-only TPS | Batch × 999 / decode-and-repick seconds |
| Final KV cache | Batch × (prompt + 999) × KV bytes per token |

More batch reuse can improve total throughput while each request slows down. Per-token active parameters do not change with batch. KV cache is separate for each request.

MoE has a second complication: different requests may choose different experts. Choose **same set**, **independent uniform picks (rounded expected union)**, or **maximum spread**. The whole modeled expert union must fit the expert cache. Increase cache capacity and total DRAM as needed; the simulator does not silently upgrade hardware. Increase the manually supplied workspace budget when batch activations grow.

The independent scenario is a rounded mean, not a guarantee against memory exhaustion. Maximum spread models the largest possible union. Hit rate remains an independent assumption with a forced minimum from retained-set overlap.

## KV precision and fast controls

Select **FP16 / BF16 / FP8 / INT8 / INT4** independently of weight precision. Keep the original 192 KB/token **16-bit reference**, or switch to attention geometry (cached layers, KV heads, head dimension). Payload, metadata and total KV update together. Metadata fraction and conversion time are optional explicit assumptions; zero means ideal payload-only/no-extra-time. See [MODEL.md](docs/MODEL.md#kv-sizing-and-quantization) for limitations.

Small buttons below numeric inputs apply common values in one click. Direct typing and +/-1 remain available. Disabled geometry/reference controls indicate which sizing method is active.

## Auto increase / decrease

1. Select a parameter in **Auto sweep**.
2. Choose **Common values** or a custom **From / To / Step** range, then Increase or Decrease.
3. Press **Start**. It starts at the first endpoint (not at the current value).
4. Watch the TOPS points, results and **Sweep history**. Switch the history metric between TPS, TTFT, TPOT and KV GB.
5. Use **Pause / Resume** or **Restore baseline**. The endpoint stops automatically. A manual parameter edit resets the trace; hiding the tab pauses playback.

The sweep uses fixed graph axes across its entire planned range, including future values, to make movements comparable. Up to 200 points; a shorter final step includes the exact endpoint. Other inputs reset to the same baseline at each sample, including cache-hit assumptions before the overlap floor. Infeasible speed points leave gaps; KV size is still inspectable. Playback speed changes animation timing only, never hardware performance. Reduced-motion preferences disable transitions; playback always requires explicit Start.

## Roofline

X is counted model operations / modeled DRAM bytes. Y is counted model operations / phase time in TOPS. Blue is decode including repick stalls; red is prefill excluding initial loading. Changing batch moves points; fixed hardware ceilings stay fixed in data coordinates. Axes auto-scale during manual editing and lock to the planned domain during a sweep.

The roof is `min(effective phase TOPS, usable DRAM GB/s × intensity / 1,000)`. Detailed formulas and limitations are in [docs/MODEL.md](docs/MODEL.md) and the in-app **Details & assumptions** dialog.

## Verify

Node.js 20+:

```sh
npm ci
npm test
```

The app has no production dependencies; `linkedom` is used only for DOM integration tests. Tests exercise the Batch=1 regression, expert unions, cache/DRAM limits, latency/throughput identities, Roofline bounds, invalid inputs, linked updates and reset.

## Repository

[SeokMinKo/moe-inference-simulator](https://github.com/SeokMinKo/moe-inference-simulator)

Clone the repository, then open `index.html` in your browser:

```sh
git clone https://github.com/SeokMinKo/moe-inference-simulator.git
cd moe-inference-simulator
```

For a single-file copy, download `moe-inference-simulator.html`. GitHub displays HTML source; download it and open the local file to run the simulator. Automated tests and standalone-build consistency checks are configured in `.github/workflows/test.yml`.

## Suggested next features / 다음 기능 제안

1. **Saved scenario comparison**: overlay multiple saved Batch / UFS / cache cases. Auto sweep is now implemented; persistent named scenarios and overlays remain future work.
2. **Benchmark calibration**: import measured TTFT, TPOT, cache misses and effective bandwidth; show estimate error and calibrated coefficients. 실측과 가정을 구분합니다.
3. **Repick timeline + tail latency**: show normal token gaps and UFS refill spikes separately; add P95/P99 once a latency distribution is supplied. 평균 TPS가 가리는 지연을 설명합니다.
4. **Trace-driven expert cache**: replay layer/expert selections and simulate LRU/LFU so hit rate emerges from cache size and access patterns.
5. **PIM/offload placement comparison**: compare GPU/NPU-only and an explicit PIM partition, with PIM compute/BW, supported operations and transfer overhead. Avoid a generic speedup multiplier.

The five items above remain proposals. KV precision, quick-value buttons and auto sweep are implemented in v1.1. Continuous batching, multi-device communication, speculative decoding and real answer-quality evaluation are also outside this version.

## Sources and provenance

- [All About Transformer Inference — How To Scale Your Model](https://jax-ml.github.io/scaling-book/inference/): batching, weight reuse, KV memory, throughput versus latency.
- [All About Rooflines](https://jax-ml.github.io/scaling-book/roofline/): arithmetic intensity and hardware ceilings.
- [MoE-Lightning paper](https://arxiv.org/abs/2411.11217): offloaded MoE batch inference and hierarchical memory constraints. Its measured speedups are **not** used as calibration for this simulator.

Source UI and Batch=1 numerical model: the user's teaching deck, recovered version 13. Batch extension: September 14, 2026. The IFP scheduling assumptions and quality proxy are project-specific teaching choices; they are not claims established by the linked papers.
