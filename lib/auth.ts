import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { supabase } from './supabase'
import bcrypt from 'bcryptjs'
import { rateLimit } from './rate-limit'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const normalizedEmail = credentials.email.toLowerCase().trim()

        // Brute-force protection: max 5 login attempts per email per minute.
        // In-memory limit (resets per serverless instance) is acceptable here
        // because bcrypt.compare is slow enough that even unlimited attempts
        // can only do ~10 guesses/sec/instance.
        const { allowed } = rateLimit(`login:${normalizedEmail}`, 5)
        if (!allowed) {
          // Returning null gives the same generic error as a wrong password —
          // no leak that the account is being throttled.
          return null
        }

        const { data: user } = await supabase
          .from('users')
          .select('email, name, password_hash, blocked')
          .eq('email', normalizedEmail)
          .maybeSingle()

        if (!user) return null
        if (user.blocked) return null
        if (!user.password_hash) return null // Google-only user, no password set

        const valid = await bcrypt.compare(credentials.password, user.password_hash)
        if (!valid) return null

        return { id: user.email, email: user.email, name: user.name }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async signIn({ user, account }) {
      if (user.email) {
        try {
          // Check if user is blocked
          const { data: existingUser } = await supabase
            .from('users')
            .select('blocked')
            .eq('email', user.email)
            .single()

          if (existingUser?.blocked) {
            return false // Block sign-in
          }

          // Upsert user — only update name, never overwrite role
          // Only auto-create users for Google sign-in (credentials users are created via /api/auth/signup)
          if (existingUser) {
            await supabase
              .from('users')
              .update({ name: user.name || '' })
              .eq('email', user.email)
          } else if (account?.provider === 'google') {
            await supabase
              .from('users')
              .insert({ email: user.email, name: user.name || '', role: 'student' })
          }
        } catch (err) {
          console.error('Supabase upsert error:', err)
          // Don't block sign-in if DB fails
        }
      }
      return true
    },
    async jwt({ token, user }) {
      // Always fetch role from DB to keep it current
      const email = user?.email || token.email
      if (email) {
        try {
          const { data } = await supabase
            .from('users')
            .select('role')
            .eq('email', email as string)
            .single()
          token.role = data?.role || 'student'
        } catch {
          token.role = token.role || 'student'
        }
      }
      if (user) {
        token.email = user.email
        token.name = user.name
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email as string
        session.user.name = token.name as string
        session.user.role = (token.role as 'superadmin' | 'teacher' | 'student') || 'student'
      }
      return session
    },
  },
  pages: {
    signIn: '/',
  },
}
