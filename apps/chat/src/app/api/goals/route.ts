import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

interface Goal {
  id: string
  title: string
  description: string | null
  why: string | null
  status: string
  related_topics: string[] | null
  related_people: string[] | null
  created_at: string
}

// GET: Lista goals dell'utente
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const status = searchParams.get('status') // 'active', 'all', etc.

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    let query = supabase
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (status === 'active') {
      query = query.in('status', ['exploring', 'active'])
    } else if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      console.error('[Goals] Fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ goals: data || [] })

  } catch (error) {
    console.error('[Goals] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST: Crea nuovo goal
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, title, description, why } = body

    if (!userId || !title) {
      return NextResponse.json(
        { error: 'userId and title required' },
        { status: 400 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await supabase
      .from('goals')
      .insert({
        user_id: userId,
        title,
        description: description || null,
        why: why || null,
        status: 'exploring', // Inizia sempre in esplorazione
      })
      .select()
      .single()

    if (error) {
      console.error('[Goals] Create error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, goal: data })

  } catch (error) {
    console.error('[Goals] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// PATCH: Aggiorna goal
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, goalId, title, description, why, status } = body

    if (!userId || !goalId) {
      return NextResponse.json(
        { error: 'userId and goalId required' },
        { status: 400 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const updates: Partial<Goal> & { updated_at: string; achieved_at?: string } = {
      updated_at: new Date().toISOString(),
    }

    if (title !== undefined) updates.title = title
    if (description !== undefined) updates.description = description
    if (why !== undefined) updates.why = why
    if (status !== undefined) {
      updates.status = status
      if (status === 'achieved') {
        updates.achieved_at = new Date().toISOString()
      }
    }

    const { data, error } = await supabase
      .from('goals')
      .update(updates)
      .eq('id', goalId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      console.error('[Goals] Update error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, goal: data })

  } catch (error) {
    console.error('[Goals] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE: Elimina goal
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const goalId = searchParams.get('goalId')

    if (!userId || !goalId) {
      return NextResponse.json(
        { error: 'userId and goalId required' },
        { status: 400 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error } = await supabase
      .from('goals')
      .delete()
      .eq('id', goalId)
      .eq('user_id', userId)

    if (error) {
      console.error('[Goals] Delete error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('[Goals] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
