import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { compare } from "bcryptjs";
import prisma from "./prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
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

        if (!user || !user.isActive || !user.passwordHash) {
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
    async signIn({ user, account, profile }) {
      // Handle Google OAuth sign in
      if (account?.provider === "google") {
        const email = user.email;

        // Require verified email
        if (!email || !(profile as { email_verified?: boolean })?.email_verified) {
          return false;
        }

        try {
          // Check if user with this email already exists
          const existingUser = await prisma.user.findUnique({
            where: { email },
            include: { accounts: true },
          });

          if (existingUser) {
            // Check if Google account is already linked
            const existingAccount = existingUser.accounts.find(
              (acc) => acc.provider === "google" && acc.providerAccountId === account.providerAccountId
            );

            if (!existingAccount) {
              // Link Google account to existing user
              await prisma.account.create({
                data: {
                  userId: existingUser.id,
                  type: account.type,
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                  refresh_token: account.refresh_token,
                  access_token: account.access_token,
                  expires_at: account.expires_at,
                  token_type: account.token_type,
                  scope: account.scope,
                  id_token: account.id_token,
                },
              });
            }

            // Update last login
            await prisma.user.update({
              where: { id: existingUser.id },
              data: { lastLogin: new Date() },
            });
          } else {
            // Create new user with Google account
            const username = email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 20);

            // Ensure username is unique
            let finalUsername = username;
            let counter = 1;
            while (await prisma.user.findUnique({ where: { username: finalUsername } })) {
              finalUsername = `${username.slice(0, 17)}_${counter}`;
              counter++;
            }

            await prisma.user.create({
              data: {
                username: finalUsername,
                email,
                name: user.name || email.split("@")[0],
                role: "VIEWER",
                profileImage: user.image,
                lastLogin: new Date(),
                accounts: {
                  create: {
                    type: account.type,
                    provider: account.provider,
                    providerAccountId: account.providerAccountId,
                    refresh_token: account.refresh_token,
                    access_token: account.access_token,
                    expires_at: account.expires_at,
                    token_type: account.token_type,
                    scope: account.scope,
                    id_token: account.id_token,
                  },
                },
              },
            });
          }

          return true;
        } catch (error) {
          console.error("OAuth sign in error:", error);
          return false;
        }
      }

      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.username = user.username;
        token.department = user.department;
        token.theme = user.theme;
      }

      // For OAuth users, fetch user data from database
      if (account?.provider === "google" && token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email },
        });

        if (dbUser) {
          token.id = String(dbUser.id);
          token.role = dbUser.role;
          token.username = dbUser.username;
          token.department = dbUser.department ?? undefined;
          token.theme = dbUser.theme;
        }
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
  trustHost: true,
  secret: (() => {
    if (!process.env.AUTH_SECRET) {
      throw new Error('AUTH_SECRET 환경변수가 설정되지 않았습니다.');
    }
    return process.env.AUTH_SECRET;
  })(),
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
