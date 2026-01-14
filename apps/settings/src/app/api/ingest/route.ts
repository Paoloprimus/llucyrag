import { NextRequest, NextResponse } from 'next/server'
import { ingestUserChats } from '@llucy/rag'

// Aumenta il limite per file grandi (max 4.5MB su Vercel)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
}

export async function POST(request: NextRequest) {
  try {
    const { files, userId } = await request.json()

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nessun file fornito' },
        { status: 400 }
      )
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID mancante' },
        { status: 400 }
      )
    }

    // Verifica config
    const config = {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
      cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN || '',
    }

    if (!config.cloudflareAccountId || !config.cloudflareApiToken) {
      return NextResponse.json(
        { success: false, error: 'Configurazione Cloudflare mancante' },
        { status: 500 }
      )
    }

    // Processa i file
    const result = await ingestUserChats(files, userId, config)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    // Aggiorna flag has_rag dell'utente
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(config.supabaseUrl, config.supabaseKey)
    
    await supabase
      .from('users')
      .update({ has_rag: true })
      .eq('id', userId)

    return NextResponse.json({
      success: true,
      conversationsProcessed: result.conversationsProcessed,
      chunksCreated: result.chunksCreated,
    })

  } catch (error) {
    console.error('Ingest error:', error)
    return NextResponse.json(
      { success: false, error: 'Errore durante il processing' },
      { status: 500 }
    )
  }
}
