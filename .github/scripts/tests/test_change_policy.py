import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from change_policy import classify, event_refs, is_doc_path
from check_docs import check, references


class PathPolicyTests(unittest.TestCase):
    def test_static_documentation(self):
        for p in ["README.md", "agent_docs/deployment.md", "docs/guide.md", "docs/介绍.md", "docs/assets/film.mp4", "agent_docs/assets/cover.png"]:
            with self.subTest(path=p): self.assertTrue(is_doc_path(p))

    def test_runtime_and_unknown_paths_fail_closed(self):
        for p in ["app/page.tsx", "lib/ai/prompts/prompt.md", "package-lock.json", "prisma/schema.prisma", "Dockerfile", ".github/workflows/ci.yml", ".github/scripts/change_policy.py", "AGENTS.md", "CLAUDE.md", ".claude/agents/qa.md", ".harness/spec.md", "docs/skills/SKILL.md", "docs/prompts/system.md", "public/guide.md", "docs/guide.mdx", "docs/assets/run.js", "mystery.md", "docs/../app/page.md", "/README.md", "docs\\guide.md"]:
            with self.subTest(path=p): self.assertFalse(is_doc_path(p))

    def test_event_ranges(self):
        repo = {"default_branch": "main"}
        self.assertEqual(event_refs({"pull_request": {"base": {"sha": "base"}, "head": {"sha": "head"}}}, "pull_request", {}), ("base", "head", True))
        self.assertEqual(event_refs({"repository": repo, "ref": "refs/heads/main", "before": "base", "after": "head"}, "push", {}), ("base", "head", False))
        # Both first push and a later docs-only follow-up compare the whole feature branch.
        for before in ["0" * 40, "earlier-code-commit"]:
            self.assertEqual(event_refs({"repository": repo, "ref": "refs/heads/feature", "before": before, "after": "head"}, "push", {}), ("origin/main", "head", True))


class RepositoryTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.repo = Path(self.tmp.name)
        self.git("init", "-q")
        self.git("config", "user.name", "Policy test")
        self.git("config", "user.email", "policy@example.invalid")
        self.write("README.md", "# Demo\n\n[Guide](docs/guide.md)\n")
        self.write("docs/guide.md", "# Guide\n")
        self.write("app/main.ts", "export const value = 1;\n")
        self.commit()
        self.base = self.git("rev-parse", "HEAD").strip()

    def tearDown(self): self.tmp.cleanup()
    def git(self, *args): return subprocess.check_output(["git", "-C", str(self.repo), *args], stderr=subprocess.PIPE, text=True)
    def write(self, name, text):
        p = self.repo / name; p.parent.mkdir(parents=True, exist_ok=True); p.write_text(text)
    def commit(self): self.git("add", "-A"); self.git("commit", "-qm", "change")
    def scope(self, **kw): return classify(self.repo, self.base, **kw)

    def test_docs_change_is_light(self):
        self.write("README.md", "# Film\n\n[Guide](docs/guide.md)\n"); self.commit()
        self.assertTrue(self.scope()["docs_only"])
        self.assertEqual(check(self.repo, self.scope()), [])

    def test_code_and_mixed_changes_are_full(self):
        self.write("app/main.ts", "export const value = 2;\n"); self.commit()
        self.assertFalse(self.scope()["docs_only"])
        self.write("README.md", "# Docs follow-up\n"); self.commit()
        self.assertFalse(self.scope()["docs_only"])

    def test_workflow_change_is_full(self):
        self.write(".github/workflows/ci.yml", "name: CI\n"); self.commit()
        self.assertFalse(self.scope()["docs_only"])

    def test_code_renamed_to_markdown_is_full(self):
        self.git("mv", "app/main.ts", "docs/main.md"); self.commit()
        self.assertFalse(self.scope()["docs_only"])

    def test_uncommitted_code_and_untracked_files_are_included(self):
        self.write("README.md", "# Pending docs\n")
        self.assertTrue(self.scope(working_tree=True)["docs_only"])
        self.write("app/new.ts", "export const newValue = true;\n")
        self.assertFalse(self.scope(working_tree=True)["docs_only"])
        self.git("add", "app/new.ts")
        self.assertFalse(self.scope(working_tree=True)["docs_only"])

    def test_symlink_and_executable_docs_are_full(self):
        self.git("rm", "docs/guide.md"); (self.repo / "docs").mkdir(exist_ok=True); (self.repo / "docs/guide.md").symlink_to("../app/main.ts"); self.commit()
        self.assertFalse(self.scope()["docs_only"])
        (self.repo / "docs/guide.md").unlink(); self.write("docs/guide.md", "# Executable\n"); (self.repo / "docs/guide.md").chmod(0o755); self.commit()
        self.assertFalse(self.scope()["docs_only"])

    def test_unavailable_diff_does_not_get_light_route(self):
        self.assertFalse(classify(self.repo, "missing-ref")["docs_only"])

    def test_new_broken_local_reference_fails(self):
        self.write("README.md", "# Demo\n[Missing](docs/no-such.md)\n"); self.commit()
        self.assertTrue(check(self.repo, self.scope()))

    def test_deleting_target_checks_unchanged_readme(self):
        self.git("rm", "docs/guide.md"); self.commit()
        errors = check(self.repo, self.scope())
        self.assertTrue(any("missing local reference" in e for e in errors))

    def test_old_unrelated_bad_link_does_not_expand_scope(self):
        self.write("README.md", "# Old\n[Old issue](docs/missing.md)\n"); self.commit(); self.base = self.git("rev-parse", "HEAD").strip()
        self.write("README.md", "# Updated title\n[Old issue](docs/missing.md)\n"); self.commit()
        self.assertEqual(check(self.repo, self.scope()), [])

    def test_code_examples_are_not_links(self):
        self.assertEqual(references("```md\n[x](not-a-real-file.md)\n```\n`[x](also-an-example.md)`"), set())

    def test_new_html_references_and_unicode_paths(self):
        self.write("docs/中文.md", "# 中文\n")
        self.write("README.md", '<a href="docs/%E4%B8%AD%E6%96%87.md">中文</a>\n'); self.commit()
        self.assertEqual(check(self.repo, self.scope()), [])

    def test_traversal_and_merge_markers_fail(self):
        self.write("README.md", "[Outside](../../secret.md)\n<<<<<<< HEAD\n"); self.commit()
        self.assertEqual(len(check(self.repo, self.scope())), 2)

    def test_invalid_utf8_fails(self):
        (self.repo / "README.md").write_bytes(b"# bad\n\xff"); self.commit()
        self.assertTrue(check(self.repo, self.scope()))


if __name__ == "__main__": unittest.main()
