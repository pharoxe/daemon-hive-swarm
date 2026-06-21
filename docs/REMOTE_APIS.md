# Remote APIs

Daemon is local-first. Remote calls occur only for model weight downloads, optional cloud chat (user API keys), optional agent tools, wallet/RPC reads, and Hive P2P (Hyperswarm/Hypercore — peer-to-peer, not a central REST API).

Source of truth in code: `src/runtime/toolRuntime.ts` (`onchainApiSources`), `src/runtime/cloudClient.ts`, `src/runtime/modelManifest.ts`, `src/config/env.ts`.

---

## Default demo path (no remote inference)

The QVAC hackathon demo runs with **local QVAC inference only**. No cloud LLM keys are required. Optional tool calls (onchain, web search) are permission-gated and off unless enabled.

---

## Model artifact downloads

| Source | Base URL / mechanism | When used | Auth |
| --- | --- | --- | --- |
| Hugging Face | `https://huggingface.co/.../resolve/main/*.gguf` | HTTPS model add-ons (Qwen 3.5, Gemma 4, MedPsy, Llama 3.2) | Public resolve URLs; no key in repo |
| QVAC registry | SDK constants (`QWEN3_600M_INST_Q4`, `WHISPER_TINY`, etc.) resolved via QVAC SDK | Registry-backed add-ons (Whisper, OCR, embeddings, legacy Qwen) | QVAC SDK fetch/DHT; configured in `qvac.config.json` |

Full URL list: `src/runtime/modelManifest.ts`.

---

## Optional cloud LLM (online mode)

Requires keys in the local credentials vault (`src/runtime/localStore.ts`). Not used in the default local demo.

| Provider | Endpoint | Default model | Trigger |
| --- | --- | --- | --- |
| OpenAI | `POST https://api.openai.com/v1/chat/completions` | `gpt-4o-mini` | Vault `openaiApiKey` set |
| Anthropic | `POST https://api.anthropic.com/v1/messages` | `claude-3-5-haiku-latest` | Vault `anthropicApiKey` set |
| Google Gemini | `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` | Flash family (auto-picked) | Vault `geminiApiKey` set |
| OpenRouter | `POST https://openrouter.ai/api/v1/chat/completions` | `openai/gpt-4o-mini` | Vault `openRouterApiKey` set |

Implementation: `src/runtime/cloudClient.ts`.

---

## Agent tools — onchain / market data

Used when the **onchain** or **api** tools are enabled and the agent invokes them. Catalog: `onchainApiSources` in `src/runtime/toolRuntime.ts`.

| ID | Base URL | Access | Purpose |
| --- | --- | --- | --- |
| dexscreener | `https://api.dexscreener.com` | Public | Token/pool search, price, liquidity |
| defillama | `https://api.llama.fi` | Public | Protocol/chain/DEX macro context |
| geckoterminal | `https://api.geckoterminal.com/api/v2` | Public | Solana pool rankings, OHLCV |
| reddit | `https://www.reddit.com` | Public | Public search JSON (social context only) |
| goplus-solana | `https://api.gopluslabs.io` | Optional key | Solana token security fields |
| solana-rpc | `EXPO_PUBLIC_SOLANA_RPC_URL` (default `https://api.mainnet-beta.solana.com`) | Public / user RPC | Holders, signatures, parsed txs |
| jupiter-tokens | `https://api.jup.ag`, `https://lite-api.jup.ag` | Requires key (price v3) | Token metadata / USD price fallback |
| goldrush | `https://api.covalenthq.com` | Requires key | Portfolio / transfer history |
| dune | `https://api.dune.com` | Requires key | Curated SQL query results |
| rugcheck | `https://api.rugcheck.xyz/v1` | Public | Token risk summary |
| payai-bazaar | `https://facilitator.payai.network` | Public | x402 paid API discovery |
| coinbase-x402-bazaar | `https://api.cdp.coinbase.com/platform/v2/x402` | Public | x402 resource discovery |

RPC fallbacks in code: `https://solana-rpc.publicnode.com`, `https://api.mainnet-beta.solana.com`.

---

## Agent tools — web search

| Provider | Endpoint | Access | Trigger |
| --- | --- | --- | --- |
| DuckDuckGo Instant Answer | `GET https://api.duckduckgo.com/` | Public | Default when no Google key |
| Google Custom Search | `GET https://www.googleapis.com/customsearch/v1` | Requires `googleCustomSearchApiKey` + `googleSearchEngineId` | Preferred when vault keys set |

Implementation: `searchWebDuckDuckGo`, `searchWebGoogle` in `src/runtime/toolRuntime.ts`.

---

## Wallet / Solana Mobile

| Service | Endpoint | When used |
| --- | --- | --- |
| Solana JSON-RPC | User-configured or `EXPO_PUBLIC_SOLANA_RPC_URL` | Balance reads, onchain tool, USDC rewards prototype |
| Solana Mobile Wallet Adapter | On-device MWA session | User-initiated wallet connect / sign (not a REST API) |

---

## Hive P2P (not REST)

| Layer | Protocol | Topics | Data exchanged |
| --- | --- | --- | --- |
| Hyperswarm | P2P DHT (`HyperDHT`) | `hivemind` | Signed capability manifests, memory summaries |
| Hypercore / Corestore | P2P replication | `hive-corestore` | Opt-in anonymized dataset log blocks |

Implementation: `src/hive/hiveBackend.mjs`, `src/runtime/hiveClient.ts`. No central server; peers connect directly.

---

## Environment variables (remote-related)

| Variable | Default | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_SOLANA_RPC_URL` | `https://api.mainnet-beta.solana.com` | Solana RPC for wallet/onchain tools |
| `EXPO_PUBLIC_PAYAI_FACILITATOR_URL` | `https://facilitator.payai.network` | x402 facilitator |
| `EXPO_PUBLIC_TELEGRAM_BOT_TOKEN` | empty | Optional Telegram bridge (not used in core demo) |

Cloud and search keys are stored in the on-device vault at runtime, not in `.env`.
