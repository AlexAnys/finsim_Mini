import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // serverExternalPackages: 这些库通过 dynamic require / 自带 worker / 包含大量子文件，
  // 让 Next.js 标准 tracer 试图把整个 project 拖进 NFT 列表（参考 staging-deploy
  // "Encountered unexpected file in NFT list" 失败）。声明为 external 后 Next.js
  // 在 server bundle 时直接 require()，跳过追踪。所有这些库都只在 server 上跑
  // (document-ingestion.service.ts)，无 client 侧使用，所以 external 安全。
  serverExternalPackages: ["bcryptjs", "pdf-parse", "pdfjs-dist", "mammoth", "jszip", "xlsx"],
};

export default nextConfig;
