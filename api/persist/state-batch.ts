import type { ServerResponse } from 'node:http'
import { json, parseUrl, readJsonBody, type ApiRequest } from '../_lib/http'
import { readAppStates, upsertAppStates } from '../_lib/supabase'

export default async function handler(req: ApiRequest, res: ServerResponse) {
  try {
    const url = parseUrl(req)
    if (req.method === 'GET') {
      const rawKeys = (url.searchParams.get('keys') ?? '').trim()
      const keys = rawKeys
        .split(',')
        .map((key) => key.trim())
        .filter((key) => key !== '')
      const states = await readAppStates(keys)
      json(res, 200, { states })
      return
    }

    if (req.method === 'POST') {
      const body = (await readJsonBody(req)) as Record<string, unknown>
      const states = body.states
      if (!states || typeof states !== 'object' || Array.isArray(states)) {
        json(res, 400, { error: 'states 객체가 필요합니다.' })
        return
      }
      await upsertAppStates(states as Record<string, string>)
      json(res, 200, { ok: true })
      return
    }

    json(res, 405, { error: 'GET/POST 메서드만 허용됩니다.' })
  } catch (error) {
    const message = error instanceof Error ? error.message : '상태 저장 실패'
    json(res, 500, { error: message })
  }
}
