"use client";

import { useState, useEffect } from "react";
import { Loader2, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BlockEditorBlock, BlockEditorHandlers } from "./types";

interface Props {
  block: BlockEditorBlock;
  handlers: BlockEditorHandlers;
  // "resource" 强调"文件/PDF/视频"，"link" 强调"外部 URL"。共享 form shape，文案不同。
  variant: "resource" | "link";
}

const COPY = {
  resource: {
    urlLabel: "资源地址",
    urlPlaceholder: "https://.../xxx.pdf",
    urlHelp: "可以是 PDF / 视频 / 课件 URL；学生端会作为链接展示。",
    titleLabel: "资源标题",
    titlePlaceholder: "例如：第 3 章课件",
    confirmDelete: "确认删除此资源块？",
  },
  link: {
    urlLabel: "链接地址",
    urlPlaceholder: "https://...",
    urlHelp: "任何外部 URL；学生端作为可点击链接展示。",
    titleLabel: "链接标题",
    titlePlaceholder: "例如：参考文章",
    confirmDelete: "确认删除此链接块？",
  },
};

export function LinkOrResourceEditor({ block, handlers, variant }: Props) {
  const copy = COPY[variant];
  const initUrl = typeof block.data?.url === "string" ? block.data.url : "";
  const initTitle = typeof block.data?.title === "string" ? block.data.title : "";
  const initDesc =
    typeof block.data?.description === "string" ? block.data.description : "";

  const [url, setUrl] = useState(initUrl);
  const [title, setTitle] = useState(initTitle);
  const [description, setDescription] = useState(initDesc);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setUrl(initUrl);
    setTitle(initTitle);
    setDescription(initDesc);
  }, [block.id, initUrl, initTitle, initDesc]);

  const dirty = url !== initUrl || title !== initTitle || description !== initDesc;
  const canSave = dirty && url.trim().length > 0 && title.trim().length > 0;

  async function handleSave() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        url: url.trim(),
        title: title.trim(),
      };
      if (description.trim()) payload.description = description.trim();
      await handlers.onSave(block.id, payload);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(copy.confirmDelete)) return;
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
          {copy.urlLabel} <span className="text-danger">*</span>
        </Label>
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={copy.urlPlaceholder}
          className="mt-1 text-xs"
        />
        <p className="mt-1 text-[10px] text-ink-5">{copy.urlHelp}</p>
      </div>
      <div>
        <Label className="text-[11px] font-semibold text-ink-2">
          {copy.titleLabel} <span className="text-danger">*</span>
        </Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={copy.titlePlaceholder}
          className="mt-1 text-xs"
        />
      </div>
      <div>
        <Label className="text-[11px] font-semibold text-ink-2">描述（可选）</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="mt-1 text-xs"
          placeholder="简短说明"
        />
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!canSave || saving}
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
