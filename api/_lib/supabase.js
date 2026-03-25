import { createClient } from '@supabase/supabase-js'

let cachedClient = null

const getSupabaseAdmin = () => {
  if (cachedClient) return cachedClient
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl) throw new Error('SUPABASE_URL 환경변수가 설정되지 않았습니다.')
  if (!supabaseServiceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.')

  cachedClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cachedClient
}

export const fetchAllMatchStats = async () => {
  const supabaseAdmin = getSupabaseAdmin()
  const pageSize = 1000
  let from = 0
  const rows = []
  while (true) {
    const { data, error } = await supabaseAdmin
      .from('match_participant_stats')
      .select('id,match_id,riot_id,riot_id_normalized,summoner_name,profile_icon_id,champion_name,win,kills,deaths,assists,damage,vision_score,game_creation,game_duration,created_at')
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < pageSize) break
    from += pageSize
  }
  return rows
}

export const fetchMatchStatsByRiotId = async (riotIdNormalized) => {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('match_participant_stats')
    .select('id,match_id,riot_id,riot_id_normalized,summoner_name,profile_icon_id,champion_name,win,kills,deaths,assists,damage,vision_score,game_creation,game_duration,created_at')
    .eq('riot_id_normalized', riotIdNormalized)
  if (error) throw new Error(error.message)
  return data ?? []
}

export const fetchRecentMatchStats = async (weekAgo) => {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('match_participant_stats')
    .select('match_id,riot_id,riot_id_normalized,profile_icon_id,win,kills,deaths,assists,vision_score,game_creation')
    .gte('game_creation', weekAgo)
    .order('game_creation', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export const upsertMatchStats = async (rows) => {
  const supabaseAdmin = getSupabaseAdmin()
  if (!rows.length) return
  const { error } = await supabaseAdmin
    .from('match_participant_stats')
    .upsert(rows, { onConflict: 'match_id,riot_id_normalized' })
  if (error) throw new Error(error.message)
}

export const updateProfileIconByRiotKey = async (riotKey, profileIconId) => {
  const supabaseAdmin = getSupabaseAdmin()
  const { error } = await supabaseAdmin
    .from('match_participant_stats')
    .update({ profile_icon_id: profileIconId })
    .eq('riot_id_normalized', riotKey)
  if (error) throw new Error(error.message)
}

export const readAppStates = async (keys) => {
  const supabaseAdmin = getSupabaseAdmin()
  if (!keys.length) return {}
  const { data, error } = await supabaseAdmin.from('app_state_store').select('state_key,state_value').in('state_key', keys)
  if (error) throw new Error(error.message)
  const map = Object.fromEntries(keys.map((key) => [key, null]))
  for (const row of data ?? []) {
    if (typeof row.state_key === 'string' && typeof row.state_value === 'string') {
      map[row.state_key] = row.state_value
    }
  }
  return map
}

export const upsertAppStates = async (states) => {
  const supabaseAdmin = getSupabaseAdmin()
  const rows = Object.entries(states)
    .filter(([key, value]) => key.trim() !== '' && typeof value === 'string')
    .map(([key, value]) => ({ state_key: key.trim(), state_value: value, updated_at: Date.now() }))
  if (!rows.length) return
  const { error } = await supabaseAdmin.from('app_state_store').upsert(rows, { onConflict: 'state_key' })
  if (error) throw new Error(error.message)
}
