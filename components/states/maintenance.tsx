"use client";

import { Wrench } from "lucide-react";
import { StateCard, type StateAction } from "./state-card";

interface MaintenanceStateProps {
  title?: string;
  description?: string;
  primaryAction?: StateAction;
  secondaryAction?: StateAction;
  fullPage?: boolean;
}

export function MaintenanceState({
  title = "系统升级维护中",
  description = "我们正在为平台部署新功能，预计很快恢复。期间已提交的内容会自动保存。",
  primaryAction,
  secondaryAction,
  fullPage = true,
}: MaintenanceStateProps) {
  return (
    <StateCard
      icon={Wrench}
      title={title}
      description={description}
      primaryAction={primaryAction}
      secondaryAction={secondaryAction}
      variant="info"
      accentVar="var(--fs-accent)"
      tag="系统 · 维护中"
      fullPage={fullPage}
    />
  );
}
