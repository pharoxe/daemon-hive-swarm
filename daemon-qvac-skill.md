# Daemon QVAC Skill

Use this as the product/runtime policy for Daemon when adding local agents, tools, or marketplace providers.

## Runtime Posture

- Prefer QVAC-provided inference paths over parallel native plugins when a QVAC capability exists.
- Keep Daemon local-first. Cloud or delegated inference must be explicit, visible, and user-selectable.
- Treat delegated inference as provider-public-key based. Hive may discover and rank providers, but QVAC model loads connect directly to the selected provider key with local fallback when enabled.
- Keep the default phone profile viable for OnePlus 10R and Solana Seeker class devices: compact context, short predictions, and tool use instead of oversized prompts.

## Mobile Model Policy

- Default quick agent: `qwen3-600m-fabric-q8` for fast private turns.
- Primary tool agent: `qwen3-1-7b-q4` for dynamic QVAC tool calling.
- Lower-memory tool agent: `llama-tool-1b-q4` when Qwen3-1.7B is too heavy.
- Heavy local/delegated reasoning: `qwen3-4b-q4`.
- Vision/OCR: prefer `qvac-latin-ocr` and `qwen3vl-2b-multimodal-q4`; use ML Kit only as fallback evidence.
- Memory: prefer QVAC `embeddinggemma-300m-q4` over external BGE-style embedding plugins.
- Voice: use `whisper-tiny` + `VAD_SILERO_5_1_2`, active LLM, and `supertonic-tts-en`.

## Tool Calling

QVAC tool agents should receive explicit schemas for approved tools only:

- `daemon_device_context`
- `daemon_calendar_context`
- `daemon_wallet_summary`
- `daemon_spot_price`
- `daemon_onchain_analysis`
- `daemon_web_search`
- `daemon_pick_image_vision`
- `daemon_pick_file`

Tool results are evidence, not authority. Final answers should be compact, disclose uncertainty, and never imply wallet signing happened inside the agent.

## Marketplace Provider Manifests

Provider cards should be built from Hive capability manifests:

- provider public key
- peer key
- supported model ids
- tool-aware model ids
- max concurrent jobs
- last update time

Future ranking should prefer providers that advertise the requested model, tool-agent support, fresh manifests, and low current concurrency.
