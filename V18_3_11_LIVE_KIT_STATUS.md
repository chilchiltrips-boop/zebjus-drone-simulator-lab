# V18.3.11 Live kit status

- Real kit status is checked every second without reloading the page.
- Health probes are serialized (no overlapping requests) and use a 1.2 s timeout.
- Two consecutive misses or >3.5 s since last confirmed status marks the selected kit OFFLINE.
- Header, Kit Connect details and local-link indicators update immediately.
- Offline kits are retried automatically every 2.5 s using the remembered kit identity/IP/mDNS name.
- When the kit returns, the UI changes back to ONLINE/CONNECTED automatically.
- Focus return and browser network-online events trigger an immediate health/reconnect check.
