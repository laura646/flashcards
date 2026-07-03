import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      email: string
      name: string
      role: 'superadmin' | 'teacher' | 'student' | 'hr'
      is_editor?: boolean
      image?: string | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: string
    is_editor?: boolean
  }
}
