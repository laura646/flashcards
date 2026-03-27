import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { supabase } from './supabase'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async signIn({ user }) {
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
          if (existingUser) {
            await supabase
              .from('users')
              .update({ name: user.name || '' })
              .eq('email', user.email)
          } else {
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
