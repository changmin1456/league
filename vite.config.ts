import react from '@vitejs/plugin-react'
import { mkdirSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'

type RiotLeagueEntry = {
  queueType: string
  tier: string
  rank: string
  leaguePoints: number
  wins: number
  losses: number
}

type RiotMatchParticipant = {
  puuid: string
  summonerName: string
  profileIcon?: number
  riotIdGameName?: string
  riotIdTagline?: string
  teamId: number
  teamPosition?: string
  championName: string
  champLevel?: number
  kills: number
  deaths: number
  assists: number
  win: boolean
  totalMinionsKilled: number
  neutralMinionsKilled: number
  totalDamageDealtToChampions?: number
  visionScore?: number
  wardsPlaced?: number
  detectorWardsPlaced?: number
  summoner1Id: number
  summoner2Id: number
  perks?: {
    styles?: Array<{
      style: number
      selections?: Array<{ perk: number }>
    }>
  }
  item0: number
  item1: number
  item2: number
  item3: number
  item4: number
  item5: number
  item6: number
}

type RiotMatch = {
  info?: {
    queueId?: number
    gameCreation?: number
    gameDuration?: number
    participants?: RiotMatchParticipant[]
  }
}

const PROJECT_ROOT_DIR = dirname(fileURLToPath(import.meta.url))
const SQLITE_DATA_DIR = resolve(PROJECT_ROOT_DIR, '.data')
const SQLITE_DB_PATH = resolve(SQLITE_DATA_DIR, 'league.sqlite')

const normalizeRiotIdForStorage = (value: string) => value.replace(/\s+/g, '').trim().toLowerCase()

const createStatsDatabase = () => {
  mkdirSync(SQLITE_DATA_DIR, { recursive: true })
  const db = new DatabaseSync(SQLITE_DB_PATH)
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS match_participant_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id TEXT NOT NULL,
      riot_id TEXT NOT NULL,
      riot_id_normalized TEXT NOT NULL,
      summoner_name TEXT NOT NULL,
      profile_icon_id INTEGER,
      champion_name TEXT NOT NULL,
      win INTEGER NOT NULL,
      kills INTEGER NOT NULL,
      deaths INTEGER NOT NULL,
      assists INTEGER NOT NULL,
      damage INTEGER NOT NULL,
      vision_score INTEGER NOT NULL DEFAULT 0,
      game_creation INTEGER NOT NULL,
      game_duration INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      UNIQUE(match_id, riot_id_normalized)
    );
    CREATE INDEX IF NOT EXISTS idx_match_participant_stats_riot_id
      ON match_participant_stats(riot_id_normalized);
  `)
  try {
    db.exec(`ALTER TABLE match_participant_stats ADD COLUMN profile_icon_id INTEGER`)
  } catch {
    // already exists
  }
  try {
    db.exec(`ALTER TABLE match_participant_stats ADD COLUMN vision_score INTEGER NOT NULL DEFAULT 0`)
  } catch {
    // already exists
  }
  return db
}

const statsDb = createStatsDatabase()
const upsertMatchParticipantStat = statsDb.prepare(`
  INSERT INTO match_participant_stats (
    match_id,
    riot_id,
    riot_id_normalized,
    summoner_name,
    profile_icon_id,
    champion_name,
    win,
    kills,
    deaths,
    assists,
    damage,
    vision_score,
    game_creation,
    game_duration
  ) VALUES (
    :matchId,
    :riotId,
    :riotIdNormalized,
    :summonerName,
    :profileIconId,
    :championName,
    :win,
    :kills,
    :deaths,
    :assists,
    :damage,
    :visionScore,
    :gameCreation,
    :gameDuration
  )
  ON CONFLICT(match_id, riot_id_normalized) DO UPDATE SET
    riot_id = excluded.riot_id,
    summoner_name = excluded.summoner_name,
    profile_icon_id = excluded.profile_icon_id,
    champion_name = excluded.champion_name,
    win = excluded.win,
    kills = excluded.kills,
    deaths = excluded.deaths,
    assists = excluded.assists,
    damage = excluded.damage,
    vision_score = excluded.vision_score,
    game_creation = excluded.game_creation,
    game_duration = excluded.game_duration
`)
statsDb.exec(`
  CREATE TABLE IF NOT EXISTS app_state_store (
    state_key TEXT PRIMARY KEY,
    state_value TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );
`)
const upsertAppState = statsDb.prepare(`
  INSERT INTO app_state_store (state_key, state_value, updated_at)
  VALUES (:key, :value, (unixepoch() * 1000))
  ON CONFLICT(state_key) DO UPDATE SET
    state_value = excluded.state_value,
    updated_at = excluded.updated_at
`)
const readAppState = statsDb.prepare(`
  SELECT state_value FROM app_state_store WHERE state_key = ?
`)
const readPlayerStatsSummary = statsDb.prepare(`
  SELECT
    COUNT(*) AS total_games,
    COALESCE(SUM(win), 0) AS wins,
    COALESCE(SUM(kills), 0) AS kills,
    COALESCE(SUM(deaths), 0) AS deaths,
    COALESCE(SUM(assists), 0) AS assists,
    COALESCE(SUM(damage), 0) AS damage,
    AVG(
      CASE
        WHEN deaths = 0 THEN CAST(kills + assists AS REAL)
        ELSE CAST(kills + assists AS REAL) / deaths
      END
    ) AS avg_match_kda
  FROM match_participant_stats
  WHERE riot_id_normalized = ?
`)
const readPlayerChampionSummary = statsDb.prepare(`
  SELECT
    champion_name AS championName,
    COUNT(*) AS games,
    COALESCE(SUM(win), 0) AS wins,
    COUNT(*) - COALESCE(SUM(win), 0) AS losses,
    CASE
      WHEN COUNT(*) = 0 THEN 0
      ELSE CAST(COALESCE(SUM(win), 0) AS REAL) * 100.0 / COUNT(*)
    END AS winRate,
    CASE
      WHEN COALESCE(SUM(deaths), 0) = 0 THEN CAST(COALESCE(SUM(kills), 0) + COALESCE(SUM(assists), 0) AS REAL)
      ELSE CAST(COALESCE(SUM(kills), 0) + COALESCE(SUM(assists), 0) AS REAL) / COALESCE(SUM(deaths), 1)
    END AS kda,
    AVG(CAST(kills AS REAL)) AS killsAvg,
    AVG(CAST(deaths AS REAL)) AS deathsAvg,
    AVG(CAST(assists AS REAL)) AS assistsAvg
  FROM match_participant_stats
  WHERE riot_id_normalized = ?
  GROUP BY champion_name
  ORDER BY games DESC, champion_name ASC
  LIMIT 20
`)
const readStatsLeaderboard = statsDb.prepare(`
  SELECT
    riot_id_normalized AS riotKey,
    MAX(riot_id) AS riotId,
    MAX(profile_icon_id) AS profileIconId,
    COUNT(*) AS games,
    COALESCE(SUM(win), 0) AS wins,
    COUNT(*) - COALESCE(SUM(win), 0) AS losses,
    AVG(
      CASE
        WHEN deaths = 0 THEN CAST(kills + assists AS REAL)
        ELSE CAST(kills + assists AS REAL) / deaths
      END
    ) AS avgMatchKda,
    COALESCE(MAX(damage), 0) AS peakDamage
  FROM match_participant_stats
  GROUP BY riot_id_normalized
  HAVING COUNT(*) > 0
`)
const readPlayerRecentResults = statsDb.prepare(`
  SELECT win
  FROM match_participant_stats
  WHERE riot_id_normalized = ?
  ORDER BY game_creation DESC, match_id DESC
`)
const readMvpSourceRows = statsDb.prepare(`
  SELECT
    match_id AS matchId,
    riot_id AS riotId,
    riot_id_normalized AS riotKey,
    profile_icon_id AS profileIconId,
    win,
    kills,
    deaths,
    assists,
    COALESCE(vision_score, 0) AS visionScore,
    game_creation AS gameCreation
  FROM match_participant_stats
  WHERE game_creation >= ?
  ORDER BY game_creation DESC, match_id DESC
`)
const updateProfileIconByRiotKey = statsDb.prepare(`
  UPDATE match_participant_stats
  SET profile_icon_id = :profileIconId
  WHERE riot_id_normalized = :riotKey
`)

const json = (res: ServerResponse, status: number, data: unknown) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(data))
}

const parseRiotId = (riotId: string) => {
  const [gameName, ...tagParts] = riotId.split('#')
  const tagLine = tagParts.join('#')
  if (!gameName || !tagLine) return null
  return {
    gameName: gameName.trim(),
    tagLine: tagLine.trim(),
  }
}

const fetchRiot = async <T>(url: string, apiKey: string, label: string): Promise<T> => {
  const response = await fetch(url, {
    headers: {
      'X-Riot-Token': apiKey,
    },
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`${label} -> Riot API ${response.status}: ${text}`)
  }
  return (await response.json()) as T
}

const fetchRiotOptional = async <T>(
  url: string,
  apiKey: string,
  label: string,
): Promise<T | null> => {
  try {
    return await fetchRiot<T>(url, apiKey, label)
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.includes('Riot API 403') || message.includes('Riot API 404')) {
      return null
    }
    throw error
  }
}

const readJsonBody = async (req: IncomingMessage): Promise<unknown> =>
  await new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8')))
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })

const riotProxyPlugin = (
  apiKey?: string,
  tournamentApiKey?: string,
  tournamentId?: string,
  tournamentProviderId?: string,
  tournamentRegion = 'KR',
  tournamentCallbackUrl = 'https://example.com/callback',
  useTournamentStub = true,
  useLocalTournamentStub = true,
): Plugin => ({
  name: 'riot-proxy-plugin',
  configureServer(server) {
    let resolvedTournamentId = tournamentId?.trim() || ''
    let resolvedProviderId = tournamentProviderId?.trim() || ''
    server.middlewares.use(
      async (
        req: IncomingMessage & { url?: string },
        res: ServerResponse,
        next: () => void,
      ) => {
        if (req.url?.startsWith('/api/riot/tournament-code')) {
          if (req.method !== 'POST') {
            json(res, 405, { error: 'POST 메서드만 허용됩니다.' })
            return
          }
          if (useLocalTournamentStub) {
            const code = `STUB-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
            json(res, 200, { code })
            return
          }
          if (!tournamentApiKey) {
            json(res, 500, { error: 'RIOT_TOURNAMENT_API_KEY가 설정되지 않았습니다.' })
            return
          }
          try {
            if (!resolvedTournamentId) {
              const providerEndpoint = useTournamentStub
                ? 'https://asia.api.riotgames.com/lol/tournament-stub/v5/providers'
                : 'https://asia.api.riotgames.com/lol/tournament/v5/providers'
              const tournamentEndpoint = useTournamentStub
                ? 'https://asia.api.riotgames.com/lol/tournament-stub/v5/tournaments'
                : 'https://asia.api.riotgames.com/lol/tournament/v5/tournaments'

              if (!resolvedProviderId) {
                const providerUrl = `${providerEndpoint}?api_key=${encodeURIComponent(tournamentApiKey)}`
                const providerResponse = await fetch(providerUrl, {
                  method: 'POST',
                  headers: {
                    'X-Riot-Token': tournamentApiKey,
                    'Content-Type': 'application/json; charset=utf-8',
                  },
                  body: JSON.stringify({
                    region: tournamentRegion,
                    url: tournamentCallbackUrl,
                  }),
                })
                if (!providerResponse.ok) {
                  const text = await providerResponse.text()
                  json(res, providerResponse.status, { error: `토너먼트 Provider 생성 실패: ${text}` })
                  return
                }
                resolvedProviderId = String(await providerResponse.json())
              }

              const tournamentUrl = `${tournamentEndpoint}?api_key=${encodeURIComponent(tournamentApiKey)}`
              const tournamentResponse = await fetch(tournamentUrl, {
                method: 'POST',
                headers: {
                  'X-Riot-Token': tournamentApiKey,
                  'Content-Type': 'application/json; charset=utf-8',
                },
                body: JSON.stringify({
                  name: `league-inhouse-${Date.now()}`,
                  providerId: Number(resolvedProviderId),
                }),
              })
              if (!tournamentResponse.ok) {
                const text = await tournamentResponse.text()
                json(res, tournamentResponse.status, { error: `토너먼트 생성 실패: ${text}` })
                return
              }
              resolvedTournamentId = String(await tournamentResponse.json())
            }

            const body = (await readJsonBody(req)) as Record<string, unknown>
            const stage = typeof body.stage === 'string' ? body.stage : 'unknown'
            const matchId = typeof body.matchId === 'string' ? body.matchId : 'unknown'
            const groupId = typeof body.groupId === 'string' ? body.groupId : 'unknown'
            const title = typeof body.title === 'string' ? body.title : '내전'
            const startAt = typeof body.startAt === 'string' ? body.startAt : ''
            const teamAName = typeof body.teamAName === 'string' ? body.teamAName : 'teamA'
            const teamBName = typeof body.teamBName === 'string' ? body.teamBName : 'teamB'
            const metadata = [title, startAt, groupId, matchId, stage, `${teamAName} vs ${teamBName}`]
              .filter((value) => value.trim() !== '')
              .join(' | ')
              .slice(0, 480)

            const endpoint = useTournamentStub
              ? 'https://asia.api.riotgames.com/lol/tournament-stub/v5/codes'
              : 'https://asia.api.riotgames.com/lol/tournament/v5/codes'
            const response = await fetch(
              `${endpoint}?count=1&tournamentId=${encodeURIComponent(resolvedTournamentId)}&api_key=${encodeURIComponent(tournamentApiKey)}`,
              {
                method: 'POST',
                headers: {
                  'X-Riot-Token': tournamentApiKey,
                  'Content-Type': 'application/json; charset=utf-8',
                },
                body: JSON.stringify({
                  mapType: 'SUMMONERS_RIFT',
                  pickType: 'TOURNAMENT_DRAFT',
                  teamSize: 5,
                  spectatorType: 'ALL',
                  metadata,
                }),
              },
            )
            if (!response.ok) {
              const text = await response.text()
              json(res, response.status, { error: `토너먼트 코드 발급 실패: ${text}` })
              return
            }
            const codes = (await response.json()) as string[]
            const code = Array.isArray(codes) ? codes[0] : null
            if (!code) {
              json(res, 500, { error: '토너먼트 코드 응답이 비어 있습니다.' })
              return
            }
            json(res, 200, { code })
          } catch (error) {
            const message = error instanceof Error ? error.message : '토너먼트 코드 요청 실패'
            json(res, 500, { error: message })
          }
          return
        }

        if (req.url?.startsWith('/api/persist/state-batch')) {
          const url = new URL(req.url ?? '', 'http://localhost')
          if (req.method === 'GET') {
            const rawKeys = (url.searchParams.get('keys') ?? '').trim()
            const keys = rawKeys
              .split(',')
              .map((key) => key.trim())
              .filter((key) => key !== '')
            const states = keys.reduce<Record<string, string | null>>((acc, key) => {
              const row = readAppState.get(key) as { state_value?: string } | undefined
              acc[key] = typeof row?.state_value === 'string' ? row.state_value : null
              return acc
            }, {})
            json(res, 200, { states })
            return
          }
          if (req.method === 'POST') {
            try {
              const body = (await readJsonBody(req)) as Record<string, unknown>
              const states = body.states
              if (!states || typeof states !== 'object' || Array.isArray(states)) {
                json(res, 400, { error: 'states 객체가 필요합니다.' })
                return
              }
              Object.entries(states as Record<string, unknown>).forEach(([key, value]) => {
                if (typeof key !== 'string' || key.trim() === '' || typeof value !== 'string') return
                upsertAppState.run({ key: key.trim(), value })
              })
              json(res, 200, { ok: true })
            } catch (error) {
              const message = error instanceof Error ? error.message : '상태 저장 실패'
              json(res, 500, { error: message })
            }
            return
          }
          json(res, 405, { error: 'GET/POST 메서드만 허용됩니다.' })
          return
        }

        if (req.url?.startsWith('/api/stats/player')) {
          if (req.method !== 'GET') {
            json(res, 405, { error: 'GET 메서드만 허용됩니다.' })
            return
          }
          const url = new URL(req.url ?? '', 'http://localhost')
          const riotId = (url.searchParams.get('riotId') ?? '').trim()
          if (!riotId) {
            json(res, 400, { error: 'riotId를 입력해주세요.' })
            return
          }
          const normalizedRiotId = normalizeRiotIdForStorage(riotId)
          const summary = readPlayerStatsSummary.get(normalizedRiotId) as
            | {
                total_games?: number
                wins?: number
                kills?: number
                deaths?: number
                assists?: number
                damage?: number
                avg_match_kda?: number
              }
            | undefined
          const totalGames = Number(summary?.total_games ?? 0)
          const wins = Number(summary?.wins ?? 0)
          const losses = Math.max(0, totalGames - wins)
          const kills = Number(summary?.kills ?? 0)
          const deaths = Number(summary?.deaths ?? 0)
          const assists = Number(summary?.assists ?? 0)
          const totalDamage = Number(summary?.damage ?? 0)
          const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0
          const avgMatchKdaRaw = summary?.avg_match_kda
          const totalKda = totalGames > 0 && typeof avgMatchKdaRaw === 'number' ? avgMatchKdaRaw : null
          const champions = (
            readPlayerChampionSummary.all(normalizedRiotId) as Array<{
              championName?: string
              games?: number
              wins?: number
              losses?: number
              winRate?: number
              kda?: number
              killsAvg?: number
              deathsAvg?: number
              assistsAvg?: number
            }>
          )
            .filter((row) => typeof row.championName === 'string' && row.championName.trim() !== '')
            .map((row) => ({
              championName: row.championName as string,
              games: Number(row.games ?? 0),
              wins: Number(row.wins ?? 0),
              losses: Number(row.losses ?? 0),
              winRate: Number(Number(row.winRate ?? 0).toFixed(2)),
              kda: Number(Number(row.kda ?? 0).toFixed(2)),
              kills: Number(Number(row.killsAvg ?? 0).toFixed(2)),
              deaths: Number(Number(row.deathsAvg ?? 0).toFixed(2)),
              assists: Number(Number(row.assistsAvg ?? 0).toFixed(2)),
            }))
          json(res, 200, {
            riotId,
            totalGames,
            wins,
            losses,
            winRate,
            totalKills: kills,
            totalDeaths: deaths,
            totalAssists: assists,
            totalDamage,
            totalKda: totalKda === null ? null : Number(totalKda.toFixed(2)),
            champions,
          })
          return
        }

        if (req.url?.startsWith('/api/stats/home-top')) {
          if (req.method !== 'GET') {
            json(res, 405, { error: 'GET 메서드만 허용됩니다.' })
            return
          }
          const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
          const sourceRows = readMvpSourceRows.all(weekAgo) as Array<{
            matchId?: string
            riotId?: string
            riotKey?: string
            profileIconId?: number
            win?: number
            kills?: number
            deaths?: number
            assists?: number
            visionScore?: number
          }>
          const byMatch = sourceRows.reduce<Record<string, Array<{
            riotId: string
            riotKey: string
            profileIconId: number | null
            win: number
            kills: number
            deaths: number
            assists: number
            visionScore: number
          }>>>((acc, row) => {
            const matchId = typeof row.matchId === 'string' ? row.matchId : ''
            const riotId = typeof row.riotId === 'string' ? row.riotId : ''
            const riotKey = typeof row.riotKey === 'string' ? row.riotKey : ''
            const profileIconId =
              Number.isFinite(row.profileIconId) && Number(row.profileIconId) > 0 ? Number(row.profileIconId) : null
            if (!matchId || !riotId || !riotKey) return acc
            const list = acc[matchId] ?? []
            list.push({
              riotId,
              riotKey,
              profileIconId,
              win: Number(row.win ?? 0),
              kills: Number(row.kills ?? 0),
              deaths: Number(row.deaths ?? 0),
              assists: Number(row.assists ?? 0),
              visionScore: Number(row.visionScore ?? 0),
            })
            acc[matchId] = list
            return acc
          }, {})
          const mvpCountByRiotKey = Object.values(byMatch).reduce<
            Record<string, { riotId: string; mvpCount: number; profileIconId: number | null }>
          >(
            (acc, participants) => {
              const winners = participants.filter((participant) => participant.win === 1)
              if (winners.length === 0) return acc
              const teamKills = winners.reduce((sum, participant) => sum + participant.kills, 0)
              const best = winners.reduce<{ riotKey: string; riotId: string; profileIconId: number | null; score: number } | null>(
                (top, participant) => {
                const kp = teamKills > 0 ? ((participant.kills + participant.assists) / teamKills) * 100 : 0
                const kdaRatio =
                  participant.deaths === 0
                    ? participant.kills + participant.assists
                    : (participant.kills + participant.assists) / participant.deaths
                const score = Number((kdaRatio + kp / 25 + participant.visionScore / 20).toFixed(4))
                if (!top || score > top.score) {
                  return {
                    riotKey: participant.riotKey,
                    riotId: participant.riotId,
                    profileIconId: participant.profileIconId,
                    score,
                  }
                }
                return top
              },
              null,
            )
              if (!best) return acc
              const prev = acc[best.riotKey] ?? { riotId: best.riotId, mvpCount: 0, profileIconId: best.profileIconId }
              acc[best.riotKey] = {
                riotId: best.riotId,
                mvpCount: prev.mvpCount + 1,
                profileIconId: prev.profileIconId ?? best.profileIconId,
              }
              return acc
            },
            {},
          )
          const mvpTopRows = Object.values(mvpCountByRiotKey)
            .sort((a, b) => {
              if (b.mvpCount !== a.mvpCount) return b.mvpCount - a.mvpCount
              return a.riotId.localeCompare(b.riotId)
            })
            .slice(0, 5)
            .map((row) => ({
              riotId: row.riotId,
              mvpCount: row.mvpCount,
              profileIconId: row.profileIconId,
            }))

          const kdaTopRows = (
            readStatsLeaderboard.all() as Array<{
              riotId?: string
              riotKey?: string
              profileIconId?: number
              avgMatchKda?: number
            }>
          )
            .filter((row) => typeof row.riotId === 'string' && row.riotId.trim() !== '')
            .map((row) => ({
              riotId: String(row.riotId ?? ''),
              avgKda: Number(Number(row.avgMatchKda ?? 0).toFixed(2)),
              profileIconId:
                Number.isFinite(row.profileIconId) && Number(row.profileIconId) > 0 ? Number(row.profileIconId) : null,
            }))
            .sort((a, b) => {
              if (b.avgKda !== a.avgKda) return b.avgKda - a.avgKda
              return a.riotId.localeCompare(b.riotId)
            })
            .slice(0, 5)

          json(res, 200, {
            mvpTopRows,
            kdaTopRows,
          })
          return
        }

        if (req.url?.startsWith('/api/stats/leaderboard')) {
          if (req.method !== 'GET') {
            json(res, 405, { error: 'GET 메서드만 허용됩니다.' })
            return
          }
          const baseRows: Array<{
            riotKey: string
            riotId: string
            profileIconId: number | null
            games: number
            wins: number
            losses: number
            winRate: number
            peakDamage: number
          }> = (
            readStatsLeaderboard.all() as Array<{
              riotKey?: string
              riotId?: string
              profileIconId?: number
              games?: number
              wins?: number
              losses?: number
              avgMatchKda?: number
              peakDamage?: number
            }>
          )
            .filter((row) => typeof row.riotKey === 'string' && row.riotKey.trim() !== '')
            .map((row) => {
              const games = Number(row.games ?? 0)
              const wins = Number(row.wins ?? 0)
              const losses = Number(row.losses ?? Math.max(0, games - wins))
              const avgKda = Number(Number(row.avgMatchKda ?? 0).toFixed(2))
              const peakDamage = Number(row.peakDamage ?? 0)
              const riotKey = String(row.riotKey ?? '').trim()
              const riotIdRaw = typeof row.riotId === 'string' && row.riotId.trim() !== '' ? row.riotId : riotKey
              return {
                riotKey,
                riotId: riotIdRaw,
                profileIconId: Number.isFinite(row.profileIconId) ? Number(row.profileIconId) : null,
                games,
                wins,
                losses,
                winRate: games > 0 ? Number(((wins / games) * 100).toFixed(2)) : 0,
                avgKda,
                peakDamage,
              }
            })
          const rows = await Promise.all(
            baseRows.map(async (row) => {
              if (typeof row.profileIconId === 'number' && row.profileIconId > 0) return row
              if (!apiKey) return row
              const parsed = parseRiotId(row.riotId)
              if (!parsed) return row
              try {
                const account = await fetchRiot<{ puuid: string }>(
                  `https://asia.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(parsed.gameName)}/${encodeURIComponent(parsed.tagLine)}`,
                  apiKey,
                  `account-v1 ${row.riotId}`,
                )
                const summoner = await fetchRiot<{ profileIconId?: number }>(
                  `https://kr.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${account.puuid}`,
                  apiKey,
                  `summoner-v4 ${row.riotId}`,
                )
                const profileIconId =
                  typeof summoner.profileIconId === 'number' && Number.isFinite(summoner.profileIconId)
                    ? summoner.profileIconId
                    : null
                if (profileIconId) {
                  updateProfileIconByRiotKey.run({ riotKey: row.riotKey, profileIconId })
                }
                return { ...row, profileIconId }
              } catch {
                return row
              }
            }),
          )
          const rowsWithStreak = rows.map((row) => {
            const results = readPlayerRecentResults.all(row.riotKey) as Array<{ win?: number }>
            if (results.length === 0) {
              return {
                ...row,
                streakType: 'none' as const,
                streakCount: 0,
              }
            }
            const first = results[0]?.win === 1 ? 'win' : 'loss'
            let streakCount = 0
            for (const result of results) {
              const current = result?.win === 1 ? 'win' : 'loss'
              if (current !== first) break
              streakCount += 1
            }
            return {
              ...row,
              streakType: first,
              streakCount,
            }
          })
          json(res, 200, { rows: rowsWithStreak })
          return
        }

        const isProfileRoute = req.url?.startsWith('/api/riot/profile') ?? false
        const isMatchDetailRoute = req.url?.startsWith('/api/riot/match-detail') ?? false
        const isSaveMatchStatsRoute = req.url?.startsWith('/api/riot/save-match-stats') ?? false
        if (!isProfileRoute && !isMatchDetailRoute && !isSaveMatchStatsRoute) {
          next()
          return
        }

        if (isSaveMatchStatsRoute) {
          if (!apiKey) {
            json(res, 500, { error: 'RIOT_API_KEY가 설정되지 않았습니다.' })
            return
          }
          if (req.method !== 'POST') {
            json(res, 405, { error: 'POST 메서드만 허용됩니다.' })
            return
          }
          try {
            const body = (await readJsonBody(req)) as Record<string, unknown>
            const matchId = typeof body.matchId === 'string' ? body.matchId.replace(/\s+/g, '').trim() : ''
            const targetRiotId = typeof body.riotId === 'string' ? body.riotId.trim() : ''
            const targetRiotIdNormalized = targetRiotId ? normalizeRiotIdForStorage(targetRiotId) : ''
            if (!matchId) {
              json(res, 400, { error: 'matchId를 입력해주세요.' })
              return
            }

            const match = await fetchRiot<RiotMatch>(
              `https://asia.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(matchId)}`,
              apiKey,
              `match-v5 ${matchId}`,
            )
            const participants = match.info?.participants ?? []
            const filteredParticipants =
              targetRiotIdNormalized === ''
                ? participants
                : participants.filter((participant) => {
                    const riotId =
                      participant.riotIdGameName && participant.riotIdTagline
                        ? `${participant.riotIdGameName}#${participant.riotIdTagline}`
                        : participant.summonerName
                    return normalizeRiotIdForStorage(riotId) === targetRiotIdNormalized
                  })

            if (filteredParticipants.length === 0) {
              json(res, 404, { error: '해당 매치에서 대상 유저를 찾지 못했습니다.' })
              return
            }

            const gameCreation = match.info?.gameCreation ?? 0
            const gameDuration = match.info?.gameDuration ?? 0

            for (const participant of filteredParticipants) {
              const riotId =
                participant.riotIdGameName && participant.riotIdTagline
                  ? `${participant.riotIdGameName}#${participant.riotIdTagline}`
                  : participant.summonerName
              upsertMatchParticipantStat.run({
                matchId,
                riotId,
                riotIdNormalized: normalizeRiotIdForStorage(riotId),
                summonerName: participant.summonerName,
                profileIconId: Number.isFinite(participant.profileIcon) ? Number(participant.profileIcon) : null,
                championName: participant.championName,
                win: participant.win ? 1 : 0,
                kills: participant.kills,
                deaths: participant.deaths,
                assists: participant.assists,
                damage: participant.totalDamageDealtToChampions ?? 0,
                visionScore: participant.visionScore ?? 0,
                gameCreation,
                gameDuration,
              })
            }

            json(res, 200, {
              matchId,
              savedCount: filteredParticipants.length,
              gameCreation,
              gameDuration,
            })
          } catch (error) {
            const message = error instanceof Error ? error.message : '매치 통계 저장 실패'
            json(res, 500, { error: message })
          }
          return
        }

        if (isMatchDetailRoute) {
          if (!apiKey) {
            json(res, 500, { error: 'RIOT_API_KEY가 설정되지 않았습니다.' })
            return
          }
          if (req.method !== 'GET') {
            json(res, 405, { error: 'GET 메서드만 허용됩니다.' })
            return
          }
          const url = new URL(req.url ?? '', 'http://localhost')
          const matchId = (url.searchParams.get('matchId') ?? '').replace(/\s+/g, '').trim()
          if (!matchId) {
            json(res, 400, { error: 'matchId를 입력해주세요.' })
            return
          }
          try {
            const match = await fetchRiot<RiotMatch>(
              `https://asia.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(matchId)}`,
              apiKey,
              `match-v5 ${matchId}`,
            )
            const participants = match.info?.participants ?? []
            const byTeam = participants.reduce<Record<string, RiotMatchParticipant[]>>((acc, participant) => {
              const key = String(participant.teamId ?? 0)
              const list = acc[key] ?? []
              list.push(participant)
              acc[key] = list
              return acc
            }, {})

            const teams = Object.entries(byTeam)
              .map(([teamId, memberList]) => ({
                teamId: Number(teamId),
                win: memberList.some((member) => member.win),
                participants: memberList.map((member) => ({
                  puuid: member.puuid,
                  summonerName: member.summonerName,
                  riotId:
                    member.riotIdGameName && member.riotIdTagline
                      ? `${member.riotIdGameName}#${member.riotIdTagline}`
                      : member.summonerName,
                  championName: member.championName,
                  championLevel: member.champLevel ?? 0,
                  kills: member.kills,
                  deaths: member.deaths,
                  assists: member.assists,
                  win: member.win,
                  totalMinionsKilled: member.totalMinionsKilled ?? 0,
                  neutralMinionsKilled: member.neutralMinionsKilled ?? 0,
                  totalDamageDealtToChampions: member.totalDamageDealtToChampions ?? 0,
                  visionScore: member.visionScore ?? 0,
                  wardsPlaced: member.wardsPlaced ?? 0,
                  detectorWardsPlaced: member.detectorWardsPlaced ?? 0,
                  summonerSpellIds: [member.summoner1Id, member.summoner2Id],
                  primaryRuneId: member.perks?.styles?.[0]?.selections?.[0]?.perk ?? null,
                  items: [
                    member.item0,
                    member.item1,
                    member.item2,
                    member.item3,
                    member.item4,
                    member.item5,
                    member.item6,
                  ],
                })),
              }))
              .sort((a, b) => a.teamId - b.teamId)

            json(res, 200, {
              matchId,
              gameCreation: match.info?.gameCreation ?? 0,
              gameDuration: match.info?.gameDuration ?? 0,
              queueId: match.info?.queueId ?? null,
              teams,
            })
          } catch (error) {
            const message = error instanceof Error ? error.message : '매치 상세 조회 실패'
            json(res, 500, { error: message })
          }
          return
        }

        if (!isProfileRoute) {
          next()
          return
        }

      if (!apiKey) {
        json(res, 500, {
          error: 'RIOT_API_KEY가 설정되지 않았습니다.',
        })
        return
      }

      const url = new URL(req.url ?? '', 'http://localhost')
      const riotId = (url.searchParams.get('riotId') ?? '').trim()
      const parsed = parseRiotId(riotId)
      if (!parsed) {
        json(res, 400, {
          error: '아이디#태그 형식으로 입력해주세요.',
        })
        return
      }

        try {
        const account = await fetchRiot<{ puuid: string; gameName: string; tagLine: string }>(
          `https://asia.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(parsed.gameName)}/${encodeURIComponent(parsed.tagLine)}`,
          apiKey,
          'account-v1',
        )

        const summoner = await fetchRiot<{ id: string; profileIconId: number; puuid: string }>(
          `https://kr.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${account.puuid}`,
          apiKey,
          'summoner-v4',
        )

        let leagues: RiotLeagueEntry[] = []
        let rankedStatus: 'ok' | 'forbidden' | 'not_found' = 'ok'
        try {
          leagues =
            (await fetchRiotOptional<RiotLeagueEntry[]>(
              `https://kr.api.riotgames.com/lol/league/v4/entries/by-puuid/${account.puuid}`,
              apiKey,
              'league-v4 by-puuid',
            )) ?? []
        } catch (error) {
          const message = error instanceof Error ? error.message : ''
          if (message.includes('Riot API 403')) {
            rankedStatus = 'forbidden'
            leagues = []
          } else if (message.includes('Riot API 404')) {
            rankedStatus = 'not_found'
            leagues = []
          } else {
            throw error
          }
        }

        const matchIds =
          (await fetchRiotOptional<string[]>(
          `https://asia.api.riotgames.com/lol/match/v5/matches/by-puuid/${account.puuid}/ids?start=0&count=5`,
          apiKey,
          'match-v5 ids',
        )) ?? []

        const matches = await Promise.all(
          matchIds.map((matchId) =>
            fetchRiot<RiotMatch>(
              `https://asia.api.riotgames.com/lol/match/v5/matches/${matchId}`,
              apiKey,
              `match-v5 ${matchId}`,
            ),
          ),
        )

        let wins = 0
        let kills = 0
        let deaths = 0
        let assists = 0
        const championMap = new Map<string, { games: number; kills: number; deaths: number; assists: number }>()
        const recentMatches: Array<{
          result: 'WIN' | 'LOSE'
          championName: string
          kills: number
          deaths: number
          assists: number
          cs: number
          queueId: number | null
          durationSec: number
          createdAt: number
          items: number[]
          spells: number[]
          primaryRune: number | null
          primaryStyle: number | null
          subStyle: number | null
          teamPosition: string | null
          teammates: Array<{ summonerName: string; championName: string }>
          opponents: Array<{ summonerName: string; championName: string }>
        }> = []
        const lineDistribution = new Map<string, number>()

        for (const match of matches) {
          const participant = match.info?.participants?.find((p) => p.puuid === account.puuid)
          if (!participant) continue
          const participants = match.info?.participants ?? []
          if (participant.win) wins += 1
          kills += participant.kills
          deaths += participant.deaths
          assists += participant.assists

          const prev = championMap.get(participant.championName) ?? {
            games: 0,
            kills: 0,
            deaths: 0,
            assists: 0,
          }
          championMap.set(participant.championName, {
            games: prev.games + 1,
            kills: prev.kills + participant.kills,
            deaths: prev.deaths + participant.deaths,
            assists: prev.assists + participant.assists,
          })

          recentMatches.push({
            result: participant.win ? 'WIN' : 'LOSE',
            championName: participant.championName,
            kills: participant.kills,
            deaths: participant.deaths,
            assists: participant.assists,
            cs: participant.totalMinionsKilled + participant.neutralMinionsKilled,
            queueId: match.info?.queueId ?? null,
            durationSec: match.info?.gameDuration ?? 0,
            createdAt: match.info?.gameCreation ?? 0,
            items: [
              participant.item0,
              participant.item1,
              participant.item2,
              participant.item3,
              participant.item4,
              participant.item5,
              participant.item6,
            ],
            spells: [participant.summoner1Id, participant.summoner2Id],
            primaryRune: participant.perks?.styles?.[0]?.selections?.[0]?.perk ?? null,
            primaryStyle: participant.perks?.styles?.[0]?.style ?? null,
            subStyle: participant.perks?.styles?.[1]?.style ?? null,
            teamPosition: participant.teamPosition ?? null,
            teammates: participants
              .filter((p) => p.teamId === participant.teamId && p.puuid !== participant.puuid)
              .map((p) => ({
                summonerName: p.summonerName,
                championName: p.championName,
              })),
            opponents: participants
              .filter((p) => p.teamId !== participant.teamId)
              .map((p) => ({
                summonerName: p.summonerName,
                championName: p.championName,
              })),
          })

          const lane = participant.teamPosition && participant.teamPosition !== ''
            ? participant.teamPosition
            : 'UNKNOWN'
          lineDistribution.set(lane, (lineDistribution.get(lane) ?? 0) + 1)
        }

        const solo = leagues.find((entry) => entry.queueType === 'RANKED_SOLO_5x5') ?? null
        const flex = leagues.find((entry) => entry.queueType === 'RANKED_FLEX_SR') ?? null
        const totalGames = matches.length
        const recentLosses = totalGames - wins
        const kda = deaths === 0 ? kills + assists : Number(((kills + assists) / deaths).toFixed(2))

        const championKdaTop = [...championMap.entries()]
          .map(([championName, stats]) => {
            const champKda =
              stats.deaths === 0
                ? stats.kills + stats.assists
                : Number(((stats.kills + stats.assists) / stats.deaths).toFixed(2))
            return {
              championName,
              games: stats.games,
              kda: champKda,
            }
          })
          .sort((a, b) => b.games - a.games)
          .slice(0, 3)

        json(res, 200, {
          summoner: {
            riotId: `${account.gameName}#${account.tagLine}`,
            profileIconId: summoner.profileIconId,
          },
          rankedSolo: solo,
          rankedFlex: flex,
          rankedStatus,
          recent: {
            wins,
            losses: recentLosses,
            kda,
            totalGames,
          },
          championKdaTop,
          recentMatches,
          lineDistribution: {
            TOP: lineDistribution.get('TOP') ?? 0,
            JUNGLE: lineDistribution.get('JUNGLE') ?? 0,
            MIDDLE: lineDistribution.get('MIDDLE') ?? 0,
            BOTTOM: lineDistribution.get('BOTTOM') ?? 0,
            UTILITY: lineDistribution.get('UTILITY') ?? 0,
            UNKNOWN: lineDistribution.get('UNKNOWN') ?? 0,
          },
          seasonTierHistory: [],
          custom: {
            score: null,
            wins: null,
            losses: null,
          },
        })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Riot API 요청 실패'
          json(res, 500, { error: message })
        }
      },
    )
  },
})

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      react(),
      riotProxyPlugin(
        env.RIOT_API_KEY,
        env.RIOT_TOURNAMENT_API_KEY || env.RIOT_API_KEY,
        env.RIOT_TOURNAMENT_ID,
        env.RIOT_TOURNAMENT_PROVIDER_ID,
        env.RIOT_TOURNAMENT_REGION || 'KR',
        env.RIOT_TOURNAMENT_CALLBACK_URL || 'https://example.com/callback',
        env.RIOT_TOURNAMENT_USE_STUB !== 'false',
        env.RIOT_TOURNAMENT_USE_LOCAL_STUB !== 'false',
      ),
    ],
  }
})
