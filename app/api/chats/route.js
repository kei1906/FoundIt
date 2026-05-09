import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(request) {
    let supabaseAdmin
    try {
        supabaseAdmin = getSupabaseAdmin()
    } catch (err) {
        return NextResponse.json(
            { error: err.message || 'Server misconfiguration' },
            { status: 500 }
        )
    }

    const accessToken = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!accessToken) {
        return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 })
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken)
    if (userError || !userData?.user) {
        return NextResponse.json({ error: userError?.message || 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const itemId = body?.itemId
    if (!itemId) {
        return NextResponse.json({ error: 'Missing itemId' }, { status: 400 })
    }

    const { data: item, error: itemError } = await supabaseAdmin
        .from('items')
        .select('user_id')
        .eq('id', itemId)
        .single()

    if (itemError) {
        return NextResponse.json({ error: itemError.message || 'Unable to load item' }, { status: 500 })
    }

    if (!item) {
        return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    if (item.user_id === userData.user.id) {
        return NextResponse.json({ error: 'Cannot message your own item' }, { status: 400 })
    }

    const { data: existingChat, error: existingChatError } = await supabaseAdmin
        .from('chats')
        .select('id')
        .eq('item_id', itemId)
        .eq('claimer_id', userData.user.id)
        .maybeSingle()

    if (existingChatError) {
        return NextResponse.json({ error: existingChatError.message || 'Unable to query chat' }, { status: 500 })
    }

    if (existingChat) {
        return NextResponse.json({ chatId: existingChat.id })
    }

    const { data: newChat, error: createError } = await supabaseAdmin
        .from('chats')
        .insert([
            {
                item_id: itemId,
                finder_id: item.user_id,
                claimer_id: userData.user.id,
                status: 'open',
            },
        ])
        .select()
        .single()

    if (createError) {
        return NextResponse.json(
            { error: createError.message || 'Unable to create chat', details: createError.details },
            { status: 500 }
        )
    }

    return NextResponse.json({ chatId: newChat?.id })
}
