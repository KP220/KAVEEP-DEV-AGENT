# SPEC-034

## Dynamic Observe, Reason, and Tool Engineering Loop

SPEC-034 introduces a bounded multi-turn Engineering Brain state machine. Each model turn returns exactly one structured action: workspace search, sandbox file read, directory listing, sandbox edit, static validation, or finish with a final Engineering Proposal.

The tool set is fixed and contains no raw shell, arbitrary process, network, Git, source-write, approval, release, or deployment capability. Paths are canonicalized inside a verified sandbox; links and traversal are denied; non-create edits require prior observation; protected paths are denied; edit, turn, tool-call, transcript, and output budgets are enforced.

Repository and tool results are always labeled untrusted. Final proposals pass the existing deterministic Engineering Brain validator and remain review evidence only. Dynamic execution never changes the source repository.
