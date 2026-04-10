import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 30

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/jpg']

function getSupabase() {
  // Use service role key if available (bypasses RLS), fall back to anon key
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key!
  )
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user || !['teacher', 'superadmin'].includes((session.user as { role?: string }).role || '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { fileData, fileType, fileName } = await req.json()

    if (!fileData || !fileType) {
      return NextResponse.json({ error: 'File data and type required' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(fileType)) {
      return NextResponse.json({ error: 'Only JPEG and PNG images are allowed' }, { status: 400 })
    }

    const buffer = Buffer.from(fileData, 'base64')
    if (buffer.length > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 5 MB.' }, { status: 400 })
    }

    const ext = fileType === 'image/png' ? 'png' : 'jpg'
    const path = `exercises/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const supabase = getSupabase()
    const { error: uploadError } = await supabase.storage
      .from('exercise-images')
      .upload(path, buffer, {
        contentType: fileType,
        cacheControl: '31536000',
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
    }

    const { data: urlData } = supabase.storage
      .from('exercise-images')
      .getPublicUrl(path)

    return NextResponse.json({ url: urlData.publicUrl })
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
