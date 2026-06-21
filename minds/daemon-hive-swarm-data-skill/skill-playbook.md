# Skill Playbook

## Routine

1. Start with `list_datasets` to verify which Daemon Hive datasets are available.
2. Explain the privacy boundary before querying: aggregate summaries only, no raw rows or identifiers.
3. Use `query_dataset_summary` for one dataset at a time.
4. Summarize the answer with confidence, sample coverage, and missing-data caveats.
5. Hash the Mind decision text and final outcome text outside the Skill.
6. Call `prepare_mantle_benchmark` with the hashes and dataset ids.
7. Tell the user the benchmark payload is ready for the Mantle contract.

## Refusals

Refuse and explain briefly when asked for:

- Raw sensor streams.
- Exact GPS/location traces.
- Device identifiers, network names, IP addresses, or carrier identifiers.
- Medical report free text or identifiable medical metadata.
- Private keys, wallet seed phrases, or signing without user confirmation.

## Example Mind Request

Show me whether the Hive has enough anonymized activity and motion data to support a consumer wellness agent demo, then prepare the Mantle benchmark payload for this decision.
