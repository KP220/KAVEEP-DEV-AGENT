# Durable Write Transaction Journal and Crash Recovery

Authority: SPEC-019

Before Controlled Source Write, the journal wrapper copies every modified/deleted original into an isolated transaction directory and records all before/after hashes atomically. The transaction directory must be outside the source repository.

Recovery accepts only an exact journal path. It preflights every source path before changing any file. Known before-state needs no action; known approved after-state is rolled back; unknown state blocks all automatic recovery. Restored backups are hash verified and recovery is idempotent.

```text
npm run write:journaled -- <write-request.json> <transaction-root> <write-ledger-root>
npm run write:recover -- <journal.json>
```

Transaction retention and secure cleanup remain explicit future operations; recovery evidence must not be deleted automatically.
