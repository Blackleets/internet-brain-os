# Windows launcher recovery

Founder-PC installation built the Kernel and extension, then failed in readJsonOptional on launcher process metadata. A leading UTF-8 BOM reproduces the error; the actual PC file has not been inspected. Accept only a leading BOM, preserving malformed JSON rejection and process ownership checks. Use CALL for the Windows pnpm shim so diagnostics and pause execute. No credentials, state records or user stores are deleted.

32 targeted bootstrap, launcher-core and autostart tests passed locally; architecture and constitution guards and diff check passed. Remote Windows qualification and founder-PC recovery remain pending. Public launch remains blocked. Rollback these two compatibility changes only.
