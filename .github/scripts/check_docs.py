"""Check changed documentation without Node, app dependencies, servers, or network crawls."""
from __future__ import annotations

import argparse
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit

from change_policy import DOC_ROOT_FILES, classify, git, is_doc_path


def prose(text: str) -> str:
    lines, fence = [], None
    for line in text.splitlines():
        match = re.match(r"^ {0,3}(`{3,}|~{3,})", line)
        if match:
            token = match.group(1)
            if fence is None:
                fence = token
            elif token[0] == fence[0] and len(token) >= len(fence):
                fence = None
            lines.append("")
        else:
            lines.append("" if fence else line)
    return re.sub(r"(`+).*?\1", "", "\n".join(lines))


def references(text: str) -> set[str]:
    text = prose(text)
    refs = set()
    class Links(HTMLParser):
        def handle_starttag(self, tag, attrs):
            for key, value in attrs:
                if value and key in {"href", "src", "poster"}:
                    refs.add(value)
    Links().feed(text)
    for m in re.finditer(r"!?\[[^\]\n]*\]\(\s*(<[^>\n]+>|[^\s)]+(?:\([^\n)]*\)[^\s)]*)?)", text):
        refs.add(m.group(1).strip("<>"))
    for m in re.finditer(r"(?m)^ {0,3}\[[^\]]+\]:\s*(<[^>\n]+>|\S+)", text):
        refs.add(m.group(1).strip("<>"))
    refs.update(re.findall(r"https?://[^\s<>]+", text))
    return refs


def target(repo: Path, name: str, url: str) -> Path | None:
    value = urlsplit(url)
    if value.scheme in {"http", "https"} or url.startswith("//"):
        if not value.hostname:
            raise ValueError("HTTP reference has no host")
        return None
    if value.scheme in {"javascript", "vbscript"}:
        raise ValueError("active-script URL is not a documentation reference")
    if value.scheme or not value.path:
        return None
    raw = unquote(value.path)
    candidate = repo / raw.lstrip("/") if raw.startswith("/") else (repo / name).parent / raw
    candidate = candidate.resolve()
    if not candidate.is_relative_to(repo.resolve()):
        raise ValueError("local reference escapes the repository")
    return candidate


def check(repo: Path, scope: dict) -> list[str]:
    errors = []
    changes = scope["changes"]
    changed = {c["path"] for c in changes if c["doc"] and c["status"] != "D" and (c["path"].endswith(".md") or c["path"] in DOC_ROOT_FILES)}
    deleted = {(repo / c["path"]).resolve() for c in changes if c["status"] == "D" and c["doc"]}
    files = set(changed)
    # Removing an image or renaming a document must not break an unchanged README.
    if deleted:
        files.update(p for p in git(repo, "ls-files", "-z").decode().split("\0") if p.endswith(".md") and is_doc_path(p))
    for name in sorted(files):
        path = repo / name
        if not path.is_file() or path.is_symlink():
            errors.append(name + ": documentation must be a regular file")
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeError:
            errors.append(name + ": invalid UTF-8")
            continue
        if "\0" in text:
            errors.append(name + ": contains NUL bytes")
        if re.search(r"(?m)^(?:<{7}|>{7})(?:\s|$)", prose(text)):
            errors.append(name + ": unresolved merge marker")
        old_refs = set()
        if scope.get("base"):
            try:
                old_refs = references(git(repo, "show", scope["base"] + ":" + name).decode("utf-8"))
            except Exception:
                pass  # New files have no old references.
        for url in references(text):
            try:
                dest = target(repo, name, url)
                # Check new references and references affected by this deletion only.
                if url in old_refs and dest not in deleted:
                    continue
                if dest is not None and not dest.exists():
                    errors.append(name + ": missing local reference " + url)
            except ValueError as exc:
                if url not in old_refs:
                    errors.append(name + ": " + str(exc))
    return errors


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--repo", type=Path, default=Path.cwd())
    p.add_argument("--scope", type=Path)
    p.add_argument("--base", default="origin/main")
    p.add_argument("--head", default="HEAD")
    p.add_argument("--working-tree", action="store_true")
    a = p.parse_args()
    scope = json.loads(a.scope.read_text()) if a.scope else classify(a.repo, a.base, a.head, working_tree=a.working_tree)
    if scope.get("base") is None:
        if a.scope and not scope["docs_only"]:
            print("Diff unavailable: no docs-only shortcut; full validation is required.")
            return
        raise SystemExit("Cannot validate documentation without a known diff.")
    errors = check(a.repo, scope)
    for error in errors:
        print(error)
    if errors:
        raise SystemExit(1)
    print("Documentation checks passed: UTF-8, merge markers, new links and affected local references.")
    print("External URLs are syntax-checked; changed embeds should also be previewed on GitHub.")


if __name__ == "__main__":
    main()
