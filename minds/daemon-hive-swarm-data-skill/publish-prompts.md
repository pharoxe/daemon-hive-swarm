# Minds Bazaar Publish Prompts

Use these with the Mind connected to the Builder API key in `MINDS_BUILDER_API_KEY`.

## 1. Describe

Build me a Skill called "Daemon Hive Swarm Data" for the Mantle Turing Test Hackathon Consumer App track. It connects to my Daemon Hive gateway, reads only anonymized Hive P2P dataset manifests and aggregate summaries, and prepares Mantle benchmark hash payloads tied to an ERC-8004 agent identity. It must never expose raw sensor streams, exact location, device identifiers, wallet secrets, medical report text, names, dates of birth, or facility names.

Use this repository package as the source specification:

- `minds/daemon-hive-swarm-data-skill/SKILL.md`
- `minds/daemon-hive-swarm-data-skill/registry-offering.json`
- `minds/daemon-hive-swarm-data-skill/app-manifest.json`
- `minds/daemon-hive-swarm-data-skill/tool-schemas.json`
- `minds/daemon-hive-swarm-data-skill/skill-playbook.md`

## 2. Refine

Make the privacy boundary stricter: the Skill can list dataset schemas, query aggregate summaries, and prepare benchmark hashes only. Add refusals for raw rows, exact GPS, IP addresses, SSIDs, medical free text, and wallet secrets.

## 3. Build

That's it. Build it.

## 4. Inspect

Show me what this Skill can do, what it reads, and what it can change. Flag anything it should not touch.

## 5. Publish

Publish this Skill to the Bazaar as "Daemon Hive Swarm Data" so Consumer App track judges and other Minds can equip it.
