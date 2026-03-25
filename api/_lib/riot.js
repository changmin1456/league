export const normalizeRiotIdForStorage = (value) => value.replace(/\s+/g, '').trim().toLowerCase()

export const parseRiotId = (riotId) => {
  const [gameName, ...tagParts] = riotId.split('#')
  const tagLine = tagParts.join('#')
  if (!gameName || !tagLine) return null
  return {
    gameName: gameName.trim(),
    tagLine: tagLine.trim(),
  }
}

export const fetchRiot = async (url, apiKey, label) => {
  const response = await fetch(url, {
    headers: {
      'X-Riot-Token': apiKey,
    },
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`${label} -> Riot API ${response.status}: ${text}`)
  }
  return await response.json()
}

export const fetchRiotOptional = async (url, apiKey, label) => {
  try {
    return await fetchRiot(url, apiKey, label)
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.includes('Riot API 403') || message.includes('Riot API 404')) {
      return null
    }
    throw error
  }
}
