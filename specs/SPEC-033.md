# SPEC-033

## Windows DPAPI Secret Store

SPEC-033 adds a Windows CurrentUser DPAPI provider. Plaintext enters the fixed PowerShell protection command through stdin, never command arguments. Disk stores only base64-encoded DPAPI ciphertext under the external KAVEEP data root. Decryption returns a private in-memory `SecretValue`; string/JSON conversion is redacted.

`kaveep secret-import <config.json>` imports `OPENAI_API_KEY`, creates the ciphertext file exclusively, and updates config to reference `windows-dpapi`. Doctor checks ciphertext availability without decrypting. Run/recover decrypt only when constructing the OpenAI adapter.

The provider is Windows-user/machine scoped by DPAPI. Moving ciphertext to another user or machine is not a backup strategy. Rotation creates a new reviewed secret reference; plaintext is never persisted or logged by KAVEEP.
