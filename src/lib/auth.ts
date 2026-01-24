import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import prisma from "./prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: {
            username: credentials.username as string,
          },
        });

        if (!user || !user.isActive) {
          return null;
        }

        const isPasswordValid = await compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isPasswordValid) {
          return null;
        }

        // Update last login
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLogin: new Date() },
        });

        return {
          id: String(user.id),
          name: user.name,
          email: user.email ?? undefined,
          role: user.role,
          username: user.username,
          department: user.department ?? undefined,
          theme: user.theme,
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.username = user.username;
        token.department = user.department;
        token.theme = user.theme;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.username = token.username as string;
        session.user.department = token.department as string | undefined;
        session.user.theme = token.theme as string;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
});

// Type augmentation for next-auth
declare module "next-auth" {
  interface User {
    role?: string;
    username?: string;
    department?: string;
    theme?: string;
  }

  interface Session {
    user: {
      id: string;
      name: string;
      email?: string | null;
      role: string;
      username: string;
      department?: string;
      theme: string;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    username?: string;
    department?: string;
    theme?: string;
  }
}
