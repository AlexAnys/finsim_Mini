import { z } from "zod";

const id = z.string().trim().min(1).max(100);

export const rosterSchema = z.object({
  mode: z.enum(["transfer", "group"]),
  studentIds: z.array(id).min(1, "请先选择学生").max(200, "每次最多操作 200 名学生"),
  targetClassId: id,
  groupMode: z.enum(["add", "replace"]).default("add"),
  targetGroupId: id.optional(),
  newGroupName: z.string().trim().min(1, "请输入小组名称").max(200).optional(),
  preview: z.boolean().default(true),
  previewToken: z.string().min(1).max(100).optional(),
}).strict().superRefine((input, ctx) => {
  if (input.targetGroupId && input.newGroupName) {
    ctx.addIssue({ code: "custom", path: ["newGroupName"], message: "请选择已有小组或新建小组，不能同时选择" });
  }
  if (input.mode === "group" && !input.targetGroupId && !input.newGroupName) {
    ctx.addIssue({ code: "custom", path: ["targetGroupId"], message: "请选择或新建目标小组" });
  }
  if (!input.preview && !input.previewToken) {
    ctx.addIssue({ code: "custom", path: ["previewToken"], message: "请先预览本次操作影响" });
  }
});

export type RosterInput = z.infer<typeof rosterSchema>;
