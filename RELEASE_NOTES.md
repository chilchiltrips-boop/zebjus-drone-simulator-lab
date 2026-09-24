# ZEBJUS F450 Drone Lab V18.3.38

- Fixed GitHub Actions firmware publication race when a web upload advances `main` while A1/A2 are compiling.
- Workflow now requires both `ZEBJUS_FLIGHTCORE_A1_APP.bin` and `ZEBJUS_FLIGHTCORE_A2_APP.bin` before validation can pass.
- Added workflow concurrency so older source builds are cancelled when a newer firmware source/workflow commit arrives.
- Stable firmware publication now preserves newer asset-only commits and retries push up to four times instead of failing with `fetch first`.
- A1/A2 APP and optional FACTORY packages remain available as Actions artifacts even before the repository publish step.
