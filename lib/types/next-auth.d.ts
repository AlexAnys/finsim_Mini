import { DefaultSession } from "next-auth"
// 显式加载被扩展的模块；生产构建不包含 tests 中的 JWT 类型导入。
import "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: string
      classId: string | null
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string
    classId: string | null
    userId: string
    credentialVersion?: string
  }
}
