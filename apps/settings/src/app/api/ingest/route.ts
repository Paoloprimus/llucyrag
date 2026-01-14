import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Import dinamico per debug
let ingestUserChats: typeof import('@llucy/rag').ingestUserChats

// Test: verifica che la route sia raggiungibile
export async function GET() {
  return NextResponse.json({ status: 'ok', method: 'GET' })
}

export async function POST(request: NextRequest) {
  console.log('[ingest] POST ricevuto')
  
  // Test semplice per verificare che POST funzioni
  let body
  try {
    body = await request.json()
    console.log('[ingest] Body parsed successfully')
  } catch (parseError) {
    console.error('[ingest] Error parsing body:', parseError)
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const { files, userId, userEmail } = body
  console.log(`[ingest] userId: ${userId}, files: ${files?.length || 0}`)

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

    if (!config.supabaseKey) {
      return NextResponse.json(
        { success: false, error: 'Configurazione Supabase mancante (service role key)' },
        { status: 500 }
      )
    }

    if (!config.cloudflareAccountId || !config.cloudflareApiToken) {
      return NextResponse.json(
        { success: false, error: 'Configurazione Cloudflare mancante' },
        { status: 500 }
      )
    }

    // Crea client con service role (bypassa RLS)
    const supabase = createClient(config.supabaseUrl, config.supabaseKey)

    // IMPORTANTE: Assicurati che l'utente esista PRIMA di inserire chunks
    // Questo risolve il foreign key constraint
    console.log('[ingest] Checking if user exists...')
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single()

    if (!existingUser) {
      console.log('[ingest] User not found, creating...')
      // Crea l'utente se non esiste (usando service role, bypassa RLS)
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: userId,
          email: userEmail || 'unknown@email.com',
          has_rag: false,
          tier: 'beta', // Beta tester durante la fase di test
        })

      if (insertError) {
        console.error('[ingest] Error creating user:', insertError)
        return NextResponse.json(
          { success: false, error: `Errore creazione utente: ${insertError.message}` },
          { status: 500 }
        )
      }
      console.log('[ingest] User created successfully')
    } else {
      console.log('[ingest] User already exists')
    }

    // Import dinamico del modulo RAG (per debug)
    console.log('[ingest] Importing RAG module...')
    try {
      const ragModule = await import('@llucy/rag')
      ingestUserChats = ragModule.ingestUserChats
      console.log('[ingest] RAG module imported successfully')
    } catch (importError) {
      console.error('[ingest] Failed to import RAG module:', importError)
      return NextResponse.json(
        { success: false, error: `RAG import failed: ${importError}` },
        { status: 500 }
      )
    }

    // Processa i file
    console.log('[ingest] Starting file processing...')
    const result = await ingestUserChats(files, userId, config)
    console.log('[ingest] Processing result:', result)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    // Aggiorna flag has_rag dell'utente
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
