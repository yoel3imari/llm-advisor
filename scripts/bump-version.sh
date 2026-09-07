#!/usr/bin/env bash
#
# Sync the app version across every source of truth, then you tag.
#
#   bash scripts/bump-version.sh 0.2.0
#   git add -A && git commit -m "chore(release): bump to v0.2.0"
#   git tag v0.2.0 && git push origin main v0.2.0
#
# Files updated (single source of truth = the CLI argument):
#   Cargo.toml                  [workspace.package] version
#   package.json                version
#   src-tauri/tauri.conf.json   version
#   Cargo.lock                  version stanzas of workspace members only
#
# Guardrail: tags must always point at commits whose files already carry the
# release version, otherwise tauri-action substitutes v__VERSION__ from stale
# files and the published release / bundle filenames skew (see v0.1.5 vs v0.1.9).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

NEW_VERSION="${1:-}"
if [[ ! "${NEW_VERSION}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Usage: bash scripts/bump-version.sh <X.Y.Z>   (e.g. bash scripts/bump-version.sh 0.2.0)" >&2
  exit 1
fi

# Workspace member crate names (must match [workspace] members in Cargo.toml).
MEMBERS="domain hw_probe fit_engine catalog downloader library server_manager gateway llm-advisor"

python3 - "${NEW_VERSION}" "${MEMBERS}" <<'EOF'
import json
import re
import sys

new_version = sys.argv[1]
members = set(sys.argv[2].split())

def update_json(path, key):
    with open(path) as f:
        data = json.load(f)
    old = data.get(key)
    data[key] = new_version
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")
    print(f"{path}: {old} -> {new_version}")

update_json("package.json", "version")
update_json("src-tauri/tauri.conf.json", "version")

# Cargo.toml: replace version only inside [workspace.package].
path = "Cargo.toml"
with open(path) as f:
    lines = f.readlines()
in_section, old, done = False, None, False
for i, line in enumerate(lines):
    if re.match(r"^\s*\[.*\]\s*$", line):
        in_section = line.strip() == "[workspace.package]"
        continue
    if in_section and not done:
        m = re.match(r'^(\s*version\s*=\s*")[^"]+(".*)$', line)
        if m:
            old = line.strip()
            lines[i] = f"{m.group(1)}{new_version}{m.group(2)}\n"
            done = True
if not done:
    sys.exit("ERROR: [workspace.package] version not found in Cargo.toml")
with open(path, "w") as f:
    f.writelines(lines)
print(f"{path} [workspace.package]: {old} -> version = \"{new_version}\"")

# Cargo.lock: replace version only in stanzas of workspace members.
path = "Cargo.lock"
with open(path) as f:
    lines = f.readlines()
current_pkg, updated = None, []
for i, line in enumerate(lines):
    m = re.match(r'^name\s*=\s*"([^"]+)"\s*$', line)
    if m:
        current_pkg = m.group(1)
        continue
    if current_pkg in members:
        m = re.match(r'^(version\s*=\s*")[^"]+(".*)$', line)
        if m:
            lines[i] = f"{m.group(1)}{new_version}{m.group(2)}\n"
            updated.append(current_pkg)
            current_pkg = None  # one version line per stanza
if set(updated) != members:
    missing = sorted(members - set(updated))
    sys.exit(f"ERROR: Cargo.lock stanzas not found for: {missing}")
with open(path, "w") as f:
    f.writelines(lines)
print(f"{path}: updated {len(updated)} workspace member stanzas -> {new_version}")
EOF

echo ""
echo "Synced to ${NEW_VERSION}. Verify with: git diff --stat"
echo "Then: git add -A && git commit -m \"chore(release): bump to v${NEW_VERSION}\""
echo "      git tag v${NEW_VERSION} && git push origin main v${NEW_VERSION}"
