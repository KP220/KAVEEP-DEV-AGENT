# SPEC-040

## Local Command Center

Status: IMPLEMENTED_UNVERIFIED

The local-only Command Center binds to an explicit host and exposes readiness
and governed `ask` endpoints. Its request body is bounded and it invokes the
same durable session APIs; it never bypasses approval or controlled-write
boundaries. Browser-launch integration, authentication for non-loopback use,
and streaming remain outside this initial port.
