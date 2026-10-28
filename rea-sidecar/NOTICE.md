# REA integration notice

This optional integration invokes the `rea-agents` CLI as a separate local or privately hosted process. SUDO SPANDR does not claim to be the upstream REA project.

- Upstream project: https://github.com/morluto/rea
- Integration dependency: `rea-agents` version `6.8.0` (pinned)
- Upstream license: MIT, copyright 2026 morluto
- License text: https://github.com/morluto/rea/blob/main/LICENSE

The upstream MIT license and copyright notice must be retained with substantial upstream code distributions. This integration adds its own bounded HTTP adapter; it does not copy the upstream analyzer implementation into the browser.

REA results remain subject to upstream provider availability and limitations. This web lane uses only `inspect_artifact` and, for supported JavaScript/Electron inputs, `analyze_javascript_application`. It does not bundle or claim Hopper, Ghidra, IDA, Kuna, firmware extraction, dynamic execution, antivirus, or a universal clean/malicious verdict.
