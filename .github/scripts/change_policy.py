"""Conservative change routing, shared by local checks and GitHub Actions."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path, PurePosixPath
import subprocess

DOC_ROOT_FILES = {"README.md", "LICENSE", "LICENSE.md", "CHANGELOG.md", "CONTRIBUTING.md"}
DOC_DIRS = {"docs", "agent_docs"}
RUNTIME_NAMES = {"AGENTS.md", "CLAUDE.md", "SKILL.md"}
RUNTIME_DIRS = {"prompts", "skills", "agents", ".agents", ".claude", ".codex", ".harness", ".github"}
MEDIA_SUFFIXES = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg", ".mp4", ".webm", ".mov"}


def is_doc_path(name: str) -> bool:
    p = PurePosixPath(name)
    if not name or p.is_absolute() or "\\" in name or ".." in p.parts:
        return False
    if any(ord(c) < 32 for c in name):
        return False
    if p.name in RUNTIME_NAMES or set(p.parts) & RUNTIME_DIRS:
        return False
    if name in DOC_ROOT_FILES:
        return True
    if len(p.parts) < 2 or p.parts[0] not in DOC_DIRS:
        return False
    return p.suffix == ".md" or (
        len(p.parts) >= 3 and p.parts[1] == "assets" and p.suffix.lower() in MEDIA_SUFFIXES
    )


def git(repo: Path, *args: str) -> bytes:
    return subprocess.check_output(["git", "-C", str(repo), *args], stderr=subprocess.PIPE)


def commit(repo: Path, ref: str) -> str:
    return git(repo, "rev-parse", "--verify", "--end-of-options", ref + "^{commit}").decode().strip()


def event_refs(event: dict, event_name: str, env: dict) -> tuple[str, str, bool]:
    if event_name == "pull_request":
        pr = event["pull_request"]
        return pr["base"]["sha"], pr["head"]["sha"], True
    if event_name == "workflow_dispatch":
        return "origin/main", env["GITHUB_SHA"], True
    if event_name == "push":
        default = event["repository"]["default_branch"]
        head = event.get("after") or env["GITHUB_SHA"]
        if event.get("ref") == "refs/heads/" + default:
            return event["before"], head, False
        # A README follow-up must not hide earlier code changes on this branch.
        return "origin/" + default, head, True
    raise ValueError("unsupported event: " + event_name)


def classify(repo: Path, base: str, head: str = "HEAD", merge_base: bool = True, working_tree: bool = False) -> dict:
    result = {"docs_only": False, "base": None, "head": None, "changes": [], "reason": "unknown diff"}
    try:
        base_sha, head_sha = commit(repo, base), commit(repo, head)
        if merge_base:
            base_sha = git(repo, "merge-base", base_sha, head_sha).decode().strip()
        # No rename collapsing: both an old code path and a new docs path must be inspected.
        raw = git(repo, "diff", "--name-status", "--no-renames", "-z", base_sha, *([] if working_tree else [head_sha]))
        if working_tree:
            for name in git(repo, "ls-files", "--others", "--exclude-standard", "-z").split(b"\0"):
                if name:
                    raw += b"A\0" + name + b"\0"
        fields = raw.decode("utf-8", "surrogateescape").split("\0")
        changes = []
        for i in range(0, len(fields) - 1, 2):
            status, name = fields[i], fields[i + 1]
            ordinary = True
            for ref in ((base_sha,) if working_tree else (base_sha, head_sha)):
                entry = git(repo, "ls-tree", "-z", ref, "--", name)
                if entry and entry.split(b" ", 1)[0] != b"100644":
                    ordinary = False
            if working_tree:
                path = repo / name
                if path.is_symlink() or (path.exists() and (not path.is_file() or path.stat().st_mode & 0o111)):
                    ordinary = False
            changes.append({"status": status, "path": name, "doc": is_doc_path(name) and ordinary})
        result.update(docs_only=all(x["doc"] for x in changes), base=base_sha, head=head_sha,
                      changes=changes, reason="all paths are non-runtime documentation" if all(x["doc"] for x in changes)
                      else "code, configuration, runtime instructions, or unknown paths changed")
    except (subprocess.CalledProcessError, ValueError, OSError) as exc:
        result["reason"] = "diff unavailable; full checks required (" + type(exc).__name__ + ")"
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    parser.add_argument("--base", default="origin/main")
    parser.add_argument("--head", default="HEAD")
    parser.add_argument("--direct", action="store_true")
    parser.add_argument("--working-tree", action="store_true", help="Include staged, unstaged and untracked local files")
    parser.add_argument("--event", type=Path)
    parser.add_argument("--result", type=Path)
    parser.add_argument("--github-output", type=Path)
    args = parser.parse_args()
    if args.event:
        try:
            base, head, use_merge_base = event_refs(json.loads(args.event.read_text()), os.environ.get("GITHUB_EVENT_NAME", ""), os.environ)
            result = classify(args.repo, base, head, use_merge_base)
            if os.environ.get("GITHUB_EVENT_NAME") == "workflow_dispatch":
                result.update(docs_only=False, reason="explicit manual full validation")
        except (KeyError, ValueError, OSError):
            result = {"docs_only": False, "base": None, "head": None, "changes": [], "reason": "event unavailable; full checks required"}
    else:
        result = classify(args.repo, args.base, args.head, not args.direct, args.working_tree)
    payload = json.dumps(result, ensure_ascii=True, indent=2) + "\n"
    if args.result:
        args.result.write_text(payload)
    if args.github_output:
        with args.github_output.open("a") as out:
            out.write("docs_only=" + str(result["docs_only"]).lower() + "\n")
    print(payload, end="")


if __name__ == "__main__":
    main()
