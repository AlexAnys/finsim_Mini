import Image from "next/image";

type InfinityMarkProps = {
  className?: string;
};

export function InfinityMark({ className }: InfinityMarkProps) {
  return (
    <Image
      src="/brand/lingxi-logo.png"
      alt="灵析 AI 无限轨道标识"
      width={96}
      height={96}
      className={className}
      priority
    />
  );
}
