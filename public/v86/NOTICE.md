# Bundled assets for SUDO Desktop (in-page x86 PC)

These three files let the browser run a real graphical PC with no server and no
third-party origin. The emulator library itself (`v86`) comes from npm; only the
BIOS ROMs and the guest image are stored here.

| File | Size | What it is | Licence | Source |
| --- | --- | --- | --- | --- |
| `seabios.bin` | 128 KB | x86 system BIOS used by the emulator | LGPL-3.0 | SeaBIOS via copy.sh/v86 |
| `vgabios.bin` | 36 KB | VGA option ROM | LGPL-2.1 | Bochs VGABIOS via copy.sh/v86 |
| `kolibri.img` | 1.44 MB | KolibriOS bootable floppy image | GPL-2.0 | builds.kolibrios.org |

Notes:

- The emulator (`v86`, BSD-2-Clause) is installed from npm as a lazy-loaded chunk;
  its `v86.wasm` is emitted into `dist/assets` by Vite at build time.
- Exact SHA-256 pins live in `scripts/fetch-v86-assets.mjs`. Re-fetch or verify with
  `node scripts/fetch-v86-assets.mjs` / `--check`.
- KolibriOS is a small hobby operating system with a real windowed GUI. It is bundled
  because it boots in seconds from 1.4 MB — it is **not** a general-purpose Linux and
  has no modern browser, package manager or forensic tooling.
- Users can boot their own `.iso` / `.img` in the same emulator. Those files are read
  in the browser, never uploaded, and are not stored in this repository.
- Nothing here is a security boundary: a guest OS started this way runs inside the
  user's own browser tab, not in an isolated worker or VM on a server.
