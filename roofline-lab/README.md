# Roofline Lab 2.0 · Memory × Compute × Models

Self-contained HTML teaching simulator. Open [`index.html`](index.html) in a browser or access the GitHub Pages route `/roofline-lab/` after Pages deployment.

## Components

- **Memory / transfer:** UFS 5.0, PCIe 5.0/6.0 x16, LPDDR5X 4/6×16-bit, LPDDR6 4/6×24-bit, HBM3E H200/B200, HBF Grade 1/3.
- **Compute:** Qualcomm Hexagon (Snapdragon X Elite / X2 Elite), MediaTek Genio 700/1200, NVIDIA H200/B200, Google TPU v6e/TPU7x, OpenAI/Broadcom Jalapeño (manual peak only), custom.
- **Models:** DeepSeek V4.1 Flash (552B backbone + 196B Engram, 16B decode active), Qwen3.8 Flash Next (125B backbone + 51B n-gram, 6B active), GLM-5.3 Flash (320B/18B).
- **Outputs:** aggregate decode TPS, per-request TPS, footprint-vs-capacity, memory vs compute bottleneck, Roofline overlay, Batch sweep. SVG export and shareable URL query settings.

## Important modeling assumptions

These results are **not real measured inference benchmarks**, and must not be quoted as expected physical-device TPS:

1. Each memory preset models a single *logical data supply path*. UFS/PCIe represents a weight streaming transfer, **not an ALU-readable DRAM/HBM**. HBF is a bandwidth/technology what-if. The selected Compute and Memory devices are not assumed physically compatible or officially supported.
2. Compute is given in device-published peak INT8-class TOPS (NPU) or BF16 dense TFLOPS (GPU/TPU). Comparison assumes an **abstract equivalent operation** per scalar operation; it does not mean INT8 TOPS and BF16 FLOPS predict equal throughput for any checkpoint. The slider for compute efficiency partially reflects this uncertainty, not a real calibration.
3. FLOPs per decode step approximate `2 × active billion parameters × batch × 1e9 × [1+small attention factor]`. For a layer with shared weights and uniformly routed experts, transferred weight bytes approximate `shared + union(experts across B tokens)`, not `active × B` bytes.
4. Independent expert routing assumes `unique = E × (1 − (1 − k/E)^B)` selected experts across batch. Other options assume identical expert sets or disjoint worst-case union.
5. Transferred bytes per decode step include approximate main weights at selected bit width, approximate attention KV reads and assumed sparse n-gram/Engram accesses. **Additional runtime costs, tensor layouts, kernel support, attention cache behavior, host transfers, network, DMA and storage random I/O are not modeled.**
6. Aggregate TPS estimate `B / max(operations/effective_compute, transferred_bytes/effective_bandwidth)`. Per-request TPS = aggregate/B. This is an **optimistic analytical ceiling**, not a measured or guaranteed achievable throughput.
7. Total weight footprint includes all main and extra parameter tables (at user-selected weight bits) plus model-dependent KV per context length and 8% capacity margin. If the selected tier cannot hold the total, the model marks **capacity exceeded** and TPS remains a *hypothetical bound only*, not executable without sharding/caching/offloading.
8. Memory device figures are spec/theoretical bandwidth. LPDDR5X 8.533 Gb/s per pin and LPDDR6 10.667 Gb/s per pin with 8/9 payload efficiency are **explicit model assumptions**, not guaranteed per-SoC configurations. PCIe x16 is one-way link approximation, not an SSD read rate. HBF numbers are from an OCP draft speed-grade table and do not represent measured sustained bandwidth.
9. Jalapeño is publicly announced but has no verified TOPS value in the included sources. The preset shows an unavailable estimate until a custom compute peak is entered.

## Model source material

- https://deepseek.com/en/news/deepseek-v4-1-flash/
- https://github.com/QwenLM/Qwen3.8-Flash-Next
- https://huggingface.co/docs/transformers/main/en/model_doc/glm5_next

## Hardware source material

- https://news.samsungsemiconductor.com/global/samsung-unveils-industrys-most-powerful-ufs-5-0-solution-for-next-gen-on-device-ai-applications/
- https://pcisig.com/pci-express-6.0-specification
- https://my.micron.com/about/blog/memory/dram/lpddr6-enabling-scalable-power-efficient-memory-systems-for-data-centers
- https://news.skhynix.com/en/hbf-at-fms-2026/
- https://www.qualcomm.com/laptops/products/snapdragon-x2-elite
- https://genio.mediatek.com/genio-1200
- https://www.nvidia.com/en-us/data-center/hgx/
- https://docs.cloud.google.com/compute/docs/tpus/tpu-machines
- https://openai.com/index/openai-broadcom-jalapeno-inference-chip/

All referenced 2026 disclosures evaluated as of 2026-11-23. Model behavior is a teaching estimate only.