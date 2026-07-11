# SPEC-030

## Production Soak, Performance Budgets, and Corruption Matrix

SPEC-030 adds deterministic local soak coverage for a 300-file workspace, repeated incremental indexing/search, twenty durable no-action sessions and replays, duplicate-ID rejection, checkpoint corruption, credential rejection/leak scanning, and orphan lock/temp detection.

Local CI budgets are 15 seconds for the index workload, 15 seconds for durable session workload, and 30 seconds overall on the supported development baseline. These are regression ceilings rather than universal hardware guarantees. Failures report measured duration.

Replay now verifies checkpoint identity, event correlation, request artifact hash, recorded state, governance-recheck requirement, and resumability. Duplicate durable session IDs fail before mutation. Store mutation remains process-serialized in this milestone; safe concurrent multi-session scheduling is a remaining scalability task rather than an implied capability.
