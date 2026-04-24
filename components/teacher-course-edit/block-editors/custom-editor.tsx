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

export function CustomEditor({ block, handlers }: Props) {
  const initial = block.data ? JSON.stringify(block.data, null, 2) : "{}";
  const [raw, setRaw] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setRaw(initial);
    setErr(null);
  }, [block.id, initial]);

  const dirty = raw !== initial;

  async function handleSave() {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      setErr("JSON 解析失败，请检查括号/逗号/引号");
      return;
    }
    if (typeof parsed !== "object" || Array.isArray(parsed) || parsed === null) {
      setErr("payload 必须是 JSON 对象（{…}）");
      return;
    }
    setErr(null);
    setSaving(true);
    try {
      await handlers.onSave(block.id, parsed);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("确认删除此自定义块？")) return;
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
          自定义 JSON payload
        </Label>
        <p className="mt-0.5 text-[10.5px] text-ink-4">
          自由扩展内容块。保存时会校验 JSON 对象格式。
        </p>
        <Textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={12}
          className="mt-1 font-mono text-[11px]"
          spellCheck={false}
        />
        {err && <p className="mt-1 text-[11px] text-danger">{err}</p>}
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
