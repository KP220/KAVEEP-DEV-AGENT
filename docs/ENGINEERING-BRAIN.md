# LLM Adapter and Engineering Brain

Authority: SPEC-014

Engineering Brain converts bounded, hash-verified, explicitly supplied repository excerpts into a structured Engineering Proposal. Repository text is untrusted data. Models recommend; they do not govern or execute.

The provider-neutral registry accepts adapters implementing `generateStructured`. The OpenAI adapter uses the Responses API with an explicit model, JSON Schema structured output, output-token budget, timeout, and invocation-only `OPENAI_API_KEY`. No credential is returned or persisted.

Current OpenAI documentation recommends GPT-5.5 for complex reasoning and coding, but DEV-AGENT deliberately requires an explicit model ID rather than silently following a moving alias.

Proposal validation rejects unknown fields, reference mismatch, execution-authority claims, budget overflow, protected paths, unobserved modification targets, path escape, and malformed edit operations. Brain output must still pass human/policy/KCP review as applicable before a future loop may send it to Sandbox File Editor.

```text
OPENAI_API_KEY=<runtime-secret> npm run brain:run -- <brain-request.json>
```

No live API call is made by the test suite; provider behavior is tested with deterministic mocks and a captured Responses request.
