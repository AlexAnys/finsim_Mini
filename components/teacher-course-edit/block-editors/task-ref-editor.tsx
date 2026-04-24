"use client";

import { useState, useEffect } from "react";
import { Loader2, Save, Trash2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BlockEditorBlock, BlockEditorHandlers } from "./types";

interface Props {
  block: BlockEditorBlock;
  handlers: BlockEditorHandlers;
  variant: "simulation" | "quiz" | "subjective";
}

const COPY = {
  simulation: {
    title: "关联模拟任务",
    desc: "将此小节的内容指向一个 simulation 类型的 Task 模板。",
    placeholderId: "Task UUID（从任务列表复制）",
  },
  quiz: {
    title: "关联测验任务",
    desc: "将此小节的内容指向一个 quiz 类型的 Task 模板。",
    placeholderId: "Task UUID（从任务列表复制）",
  },
  subjective: {
    title: "关联主观题任务",
    desc: "将此小节的内容指向一个 subjective 类型的 Task 模板。",
    placeholderId: "Task UUID（从任务列表复制）",
  },
};

export function TaskRefEditor({ block, handlers, variant }: Props) {
  const copy = COPY[variant];
  const initTaskId = typeof block.data?.taskId === "string" ? block.data.taskId : "";
  const initNote = typeof block.data?.note === "string" ? block.data.note : "";

  const [taskId, setTaskId] = useState(initTaskId);
  const [note, setNote] = useState(initNote);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setTaskId(initTaskId);
    setNote(initNote);
  }, [block.id, initTaskId, initNote]);

  const dirty = taskId !== initTaskId || note !== initNote;

  async function handleSave() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      if (taskId.trim()) payload.taskId = taskId.trim();
      if (note.trim()) payload.note = note.trim();
      await handlers.onSave(block.id, payload);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("确认删除此任务引用块？")) return;
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
        <div className="text-[11px] font-semibold text-ink-2">{copy.title}</div>
        <p className="mt-0.5 text-[10.5px] text-ink-4">{copy.desc}</p>
      </div>

      <div>
        <Label className="text-[11px] font-semibold text-ink-2">Task ID</Label>
        <div className="mt-1 flex items-center gap-1.5">
          <Input
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
            placeholder={copy.placeholderId}
            className="flex-1 font-mono text-[11px]"
          />
          {initTaskId && (
            <Link
              href={`/teacher/tasks/${initTaskId}`}
              target="_blank"
              className="text-ink-4 hover:text-brand"
              title="在新标签页打开任务"
            >
              <ExternalLink className="size-3.5" />
            </Link>
          )}
        </div>
        <p className="mt-1 text-[10px] text-ink-5">
          在教师 → 任务列表找到目标任务后复制其 ID。留空则仅存教师备注。
        </p>
      </div>

      <div>
        <Label className="text-[11px] font-semibold text-ink-2">教师备注（可选）</Label>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="mt-1 text-xs"
          placeholder="例如：本周重点，建议在课中 5 分钟内完成。"
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
