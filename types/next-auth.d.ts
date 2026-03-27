import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      email: string
      name: string
      role: 'superadmin' | 'teacher' | 'student'
      image?: string | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: string
  }
}
