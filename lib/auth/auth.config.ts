import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import type { NextAuthConfig } from "next-auth";
import { resolveAuthSecret } from "./secret";

// 绑定已验证的凭据；JWT 不保存可用于密码校验的 bcrypt 原始 hash。
const credentialVersion = (passwordHash: string) => createHash("sha256").update(passwordHash).digest("hex");

const authConfig: NextAuthConfig = {
  // next-auth v5 读 AUTH_SECRET；保留 v4 的 NEXTAUTH_SECRET 作为 fallback 以兼容老部署。
  secret: resolveAuthSecret(),
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "邮箱", type: "email" },
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!email || !password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase().trim() },
        });

        if (!user) {
          return null;
        }

        const isPasswordValid = await compare(password, user.passwordHash);
        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          classId: user.classId,
          credentialVersion: credentialVersion(user.passwordHash),
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id as string;
        token.credentialVersion = (user as Record<string, unknown>).credentialVersion as string;
      }
      // 旧版本会话及改密前会话需重新登录；客户端 update() 不能提供权限或凭据版本。
      if (typeof token.userId !== "string" || !token.userId ||
          typeof token.credentialVersion !== "string" || !token.credentialVersion) return null;
      const current = await prisma.user.findUnique({
        where: { id: token.userId },
        select: { role: true, classId: true, name: true, email: true, passwordHash: true },
      });
      if (!current || token.credentialVersion !== credentialVersion(current.passwordHash)) return null;
      token.role = current.role;
      token.classId = current.classId;
      token.name = current.name;
      token.email = current.email;
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.userId as string;
        session.user.role = token.role as string;
        session.user.classId = token.classId as string | null;
        session.user.name = token.name;
        session.user.email = token.email ?? session.user.email;
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
export default authConfig;
