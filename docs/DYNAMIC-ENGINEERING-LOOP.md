# Dynamic Engineering Loop

`kaveep run` defaults to the SPEC-034 dynamic loop. The Brain can alternate between workspace search, verified sandbox reads, bounded directory listings, sandbox edits, and static validation before returning a final proposal.

Every action is structured and allowlisted. Non-create edits require prior observation, protected paths are denied, and turn/tool/transcript/result budgets stop runaway work. Tool results and repository content are untrusted evidence. No raw shell, network, Git, source write, approval, release, or deployment tool is exposed.

The final proposal is revalidated by the existing Engineering Brain contract, then proceeds through isolated semantic validation, reviewed patch generation, and explicit approval boundaries.
