"use client";

import { useState, useEffect } from "react";
import { Loader2, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BlockEditorBlock, BlockEditorHandlers } from "./types";

interface Props {
  block: BlockEditorBlock;
  handlers: BlockEditorHandlers;
}

export function MarkdownEditor({ block, handlers }: Props) {
  const initial = typeof block.data?.content === "string" ? block.data.content : "";
  const [content, setContent] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setContent(initial);
  }, [block.id, initial]);

  const dirty = content !== initial;

  async function handleSave() {
    setSaving(true);
    try {
      await handlers.onSave(block.id, { content });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("确认删除此图文块？")) return;
    setDeleting(true);
    try {
      await handlers.onDelete(block.id);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Label className="text-[11px] font-semibold text-ink-2">
          Markdown 内容
        </Label>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={12}
          className="mt-1 font-mono text-xs"
          placeholder="# 支持 Markdown"
        />
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!dirty || saving}
          className="flex-1"
        >
          {saving ? (
            <Loader2 className="mr-1 size-3 animate-spin" />
          ) : (
            <Save className="mr-1 size-3" />
          )}
          保存
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDelete}
          disabled={deleting}
          className="text-danger"
        >
          {deleting ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Trash2 className="size-3" />
          )}
        </Button>
      </div>
    </div>
  );
}
