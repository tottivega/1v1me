import { createClient } from '@supabase/supabase-js'

export interface RoundResult {
  matchId: string
  roundNumber: number
  minigameId: string
  winnerId: string | null // null = draw
}

export interface MatchResult {
  roomId: string
  winnerNickname: string
  loserNickname: string
  winnerScore: number
  loserScore: number
  endedReason: 'completed' | 'forfeit'
  winnerUserId?: string
  loserUserId?: string
}

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY

// If env vars are missing, fall back to mock so dev works without a DB
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

if (!supabase) {
  console.warn('[DB] SUPABASE_URL / SUPABASE_SERVICE_KEY not set — using mock persistence')
}

export async function persistMatchResult(result: MatchResult): Promise<void> {
  if (!supabase) {
    console.log('[DB] Match result (mock):', result)
    return
  }

  const { error } = await supabase.from('match_results').insert({
    room_id: result.roomId,
    winner_nickname: result.winnerNickname,
    loser_nickname: result.loserNickname,
    winner_score: result.winnerScore,
    loser_score: result.loserScore,
    ended_reason: result.endedReason,
    winner_user_id: result.winnerUserId ?? null,
    loser_user_id: result.loserUserId ?? null,
  })

  if (error) throw new Error(error.message)
  console.log('[DB] Match result saved to Supabase')
}

export async function persistRoundResult(result: RoundResult): Promise<void> {
  if (!supabase) {
    console.log('[DB] Round result (mock):', result)
    return
  }

  const { error } = await supabase.from('game_rounds').insert({
    match_id: result.matchId,
    round_number: result.roundNumber,
    minigame_id: result.minigameId,
    winner_id: result.winnerId,
  })

  if (error) throw new Error(error.message)
}
