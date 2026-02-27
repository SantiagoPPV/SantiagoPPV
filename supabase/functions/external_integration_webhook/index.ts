/**
 * sheets-sync — Supabase Edge Function
 * Agrícola Moray ERP — Fase 2
 *
 * Lee el Google Sheets del programa de fumigación y hace UPSERT en fum_programa.
 *
 * ── DEPLOY ──────────────────────────────────────────────────────────────────
 * supabase functions deploy sheets-sync
 *
 * ── SECRETS REQUERIDOS (Supabase Dashboard → Settings → Edge Functions) ────
 * GOOGLE_SERVICE_ACCOUNT_JSON  → JSON completo de la Service Account de Google
 *
 * ── PERMISOS DEL GOOGLE SHEET ───────────────────────────────────────────────
 * Compartir el Sheets con el email de la Service Account (campo client_email
 * del JSON) como Lector.
 *
 * ── COLUMNAS ESPERADAS EN EL SHEET (A → J) ──────────────────────────────────
 * A: Semana              (número, ej: 8)
 * B: Fecha               (DD/MM/YYYY, ej: 24/02/2026)
 * C: Variedad            (BILOXI | AZRA 4S | AZRA 3S Y 5S | ...)
 * D: Productos           (nombre exacto en "Productos Moray")
 * E: Dosis Por 200 litros (número, ej: 0.5)
 * F: Total               (calculado — SE IGNORA)
 * G: Inventario          (calculado — SE IGNORA)
 * H: Necesidad           (calculada — SE IGNORA)
 * I: Metodo Aplicacion   (FOLIAR | DRENCH | TOMA DOMICILIARIA | ...)
 * J: Tambos              (número, ej: 5)
 *
 * ── LLAMADA DESDE EL FRONTEND ───────────────────────────────────────────────
 * const { data, error } = await supabase.functions.invoke('sheets-sync', {
 *   body: {
 *     almacen_id: 'uuid',
 *     spreadsheet_id: '1BxiMVs...',
 *     sheet_name: 'Programa',     // optional, default: primera hoja visible
 *     data_start_row: 2,          // optional, default: 2 (fila 1 = headers)
 *     dry_run: false,             // optional, true = solo simula sin escribir
 *   }
 * })
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── CORS ──────────────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Tipos ────────────────────────────────────────────────────────────────────

interface SyncRequest {
  almacen_id: string
  spreadsheet_id: string
  sheet_name?: string
  data_start_row?: number
  dry_run?: boolean
  /** Si se especifica, solo se importan filas con Col A == este número */
  filter_semana?: number
}

interface SyncResult {
  creadas: number
  actualizadas: number
  sin_cambios: number
  errores: string[]
  synced_at: string
  total_filas_leidas: number
}

interface ProgramaRow {
  almacen_id: string
  semana: number
  fecha: string          // YYYY-MM-DD
  variedad: string
  sectores: string[]
  producto_nombre: string
  dosis_200l: number
  tambos: number
  metodo: string
  objetivo: string | null
  estatus: string
  sheets_sync_id: string
  sheets_range: string
  sheets_synced_at: string
}

// ── Catálogos de normalización ────────────────────────────────────────────────

const VARIEDAD_SECTORES: Record<string, string[]> = {
  'BILOXI':        ['1A','1B','1C','1D','1E','2A','2B','2C','2D','2E'],
  'AZRA 3S Y 5S':  ['3A','3B','3C','5A','5B','5C'],
  'AZRA 4S':       ['4A','4B','4C'],
  'AZRA 6S Y 7S':  ['6A','6B','6C','6D','7A','7B','7C','7D','7E'],
  'AZRA 1ER':      ['1A','1B','1C'],
  'GENERAL':       [],
  'MAX':           [],
}

const METODO_MAP: Record<string, string> = {
  'TOMA DOMICILIARIA':    'TOMA DOMICILIARIA',
  'FOLIAR':               'FOLIAR',
  'DRENCH':               'DRENCH',
  'INMERSIÓN':            'INMERSIÓN',
  'INMERSION':            'INMERSIÓN',
  'GENERAL':              'GENERAL',
  'PODA':                 'PODA',
  'APORTE ESPECIAL (RIEGO)': 'APORTE ESPECIAL (RIEGO)',
  'APORTE ESPECIAL':      'APORTE ESPECIAL (RIEGO)',
  'RIEGO':                'APORTE ESPECIAL (RIEGO)',
}

const VARIEDAD_ALIASES: Record<string, string> = {
  'AZRA 3 Y 5':     'AZRA 3S Y 5S',
  'AZRA 3S5S':      'AZRA 3S Y 5S',
  'AZRA 6 Y 7':     'AZRA 6S Y 7S',
  'AZRA 6S7S':      'AZRA 6S Y 7S',
  'AZRA1ER':        'AZRA 1ER',
  'AZRA 1':         'AZRA 1ER',
}

// ── Utilidades ────────────────────────────────────────────────────────────────

/** Convierte DD/MM/YYYY → YYYY-MM-DD */
function parseDate(raw: string): string | null {
  if (!raw) return null
  const clean = raw.trim()
  // Intentar DD/MM/YYYY
  const m1 = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m1) return `${m1[3]}-${m1[2].padStart(2,'0')}-${m1[1].padStart(2,'0')}`
  // Intentar YYYY-MM-DD (ya correcto)
  const m2 = clean.match(/^\d{4}-\d{2}-\d{2}$/)
  if (m2) return clean
  return null
}

/** Normaliza variedad: mayúsculas + alias */
function normalizeVariedad(raw: string): string {
  const upper = raw.trim().toUpperCase()
  return VARIEDAD_ALIASES[upper] ?? upper
}

/** Normaliza método de aplicación */
function normalizeMetodo(raw: string): string {
  const upper = raw.trim().toUpperCase()
  return METODO_MAP[upper] ?? 'FOLIAR'
}

/** Obtiene sectores automáticos según variedad */
function getSectores(variedad: string): string[] {
  return VARIEDAD_SECTORES[variedad] ?? []
}

// ── Google Auth con Service Account (JWT RS256) ───────────────────────────────

/** Codifica en base64url (sin padding) */
function base64url(data: string | Uint8Array): string {
  const bytes = typeof data === 'string'
    ? new TextEncoder().encode(data)
    : data
  let binary = ''
  bytes.forEach(b => binary += String.fromCharCode(b))
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

/**
 * Obtiene un access token de Google usando una Service Account.
 * Genera un JWT RS256 y lo intercambia por un token OAuth2.
 */
async function getGoogleAccessToken(serviceAccountJson: string): Promise<string> {
  let sa: any
  try {
    sa = JSON.parse(serviceAccountJson)
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON inválido — no es JSON válido')
  }

  if (!sa.client_email || !sa.private_key) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON debe tener client_email y private_key')
  }

  // 1. Importar la clave privada PEM
  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '')

  const binaryKey = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0))

  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  // 2. Construir el JWT
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }

  const headerB64  = base64url(JSON.stringify(header))
  const payloadB64 = base64url(JSON.stringify(payload))
  const sigInput   = `${headerB64}.${payloadB64}`

  const sigBytes = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(sigInput),
  )

  const sigB64 = base64url(new Uint8Array(sigBytes))
  const jwt = `${sigInput}.${sigB64}`

  // 3. Intercambiar JWT por access_token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })

  const tokenData = await tokenRes.json()
  if (!tokenRes.ok) {
    throw new Error(`Google auth falló: ${JSON.stringify(tokenData)}`)
  }

  return tokenData.access_token as string
}

// ── Leer Google Sheets via REST API ──────────────────────────────────────────

async function readSheet(
  accessToken: string,
  spreadsheetId: string,
  range: string,
): Promise<string[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Google Sheets API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  return (data.values as string[][] | undefined) ?? []
}

// ── Handler principal ─────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), {
      status: 405, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const syncedAt = new Date().toISOString()
  const result: SyncResult = { creadas: 0, actualizadas: 0, sin_cambios: 0, errores: [], synced_at: syncedAt, total_filas_leidas: 0 }

  try {
    // 1. Parsear body
    const body: SyncRequest = await req.json()
    const { almacen_id, spreadsheet_id, sheet_name, data_start_row = 2, dry_run = false, filter_semana } = body

    if (!almacen_id)     throw new Error('almacen_id requerido')
    if (!spreadsheet_id) throw new Error('spreadsheet_id requerido')

    // 2. Obtener service account secret
    const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    if (!serviceAccountJson) throw new Error('Secret GOOGLE_SERVICE_ACCOUNT_JSON no configurado')

    // 3. Autenticar con Google
    const accessToken = await getGoogleAccessToken(serviceAccountJson)

    // 4. Leer el Sheets
    const sheetRef  = sheet_name ?? 'Programa'
    const endRow    = 1000
    const range     = `${sheetRef}!A${data_start_row}:J${endRow}`
    const rawRows   = await readSheet(accessToken, spreadsheet_id, range)

    result.total_filas_leidas = rawRows.length

    if (rawRows.length === 0) {
      return new Response(JSON.stringify({ ...result, errores: ['El Sheets no tiene datos en el rango especificado'] }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // 5. Parsear filas y construir records
    const records: ProgramaRow[] = []
    const parseErrors: string[] = []

    rawRows.forEach((row, i) => {
      const rowNum = data_start_row + i
      // Ignorar filas completamente vacías
      if (!row || row.every(c => !c?.trim())) return

      const semanaRaw    = row[0]?.trim() ?? ''
      const fechaRaw     = row[1]?.trim() ?? ''
      const variedadRaw  = row[2]?.trim() ?? ''
      const productoRaw  = row[3]?.trim() ?? ''
      const dosisRaw     = row[4]?.trim() ?? ''
      // row[5] Total — ignorado
      // row[6] Inventario — ignorado
      // row[7] Necesidad — ignorada
      const metodoRaw    = row[8]?.trim() ?? ''
      const tambosRaw    = row[9]?.trim() ?? ''

      // Validaciones mínimas
      if (!variedadRaw && !productoRaw) return // fila separadora o título
      if (!productoRaw) {
        parseErrors.push(`Fila ${rowNum}: sin producto — omitida`)
        return
      }

      // ── Filtro de semana ──────────────────────────────────────────
      if (filter_semana != null) {
        const semanaFila = parseInt(semanaRaw) || 0
        if (semanaFila !== filter_semana) return // saltar filas de otras semanas
      }

      const fecha = parseDate(fechaRaw)
      if (!fecha) {
        parseErrors.push(`Fila ${rowNum}: fecha inválida "${fechaRaw}" — omitida`)
        return
      }

      const semana = parseInt(semanaRaw) || 0
      const variedad = normalizeVariedad(variedadRaw)
      const dosis_200l = parseFloat(dosisRaw) || 0
      const tambos = parseInt(tambosRaw) || 0

      records.push({
        almacen_id,
        semana,
        fecha,
        variedad,
        sectores: getSectores(variedad),
        producto_nombre: productoRaw,
        dosis_200l,
        tambos,
        metodo: normalizeMetodo(metodoRaw),
        objetivo: null,
        estatus: 'programada',
        sheets_sync_id: `${spreadsheet_id}_${rowNum}`,
        sheets_range: `${sheetRef}!A${rowNum}`,
        sheets_synced_at: syncedAt,
      })
    })

    // Agregar errores de parseo al resultado (no fatales)
    result.errores.push(...parseErrors)

    if (records.length === 0) {
      return new Response(JSON.stringify({ ...result, errores: [...result.errores, 'No se encontraron filas válidas para importar'] }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // 6. Dry run — solo reportar sin escribir
    if (dry_run) {
      result.creadas = records.length
      return new Response(JSON.stringify({ ...result, dry_run: true }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // 7. UPSERT en Supabase (en lotes de 100 para evitar límites)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const BATCH = 100
    for (let i = 0; i < records.length; i += BATCH) {
      const batch = records.slice(i, i + BATCH)

      const { error: upsertError } = await supabaseClient
        .from('fum_programa')
        .upsert(batch, {
          onConflict: 'sheets_sync_id',
          ignoreDuplicates: false, // Sheets siempre gana — actualiza si hay cambios
        })

      if (upsertError) {
        result.errores.push(`Lote ${Math.floor(i/BATCH)+1}: ${upsertError.message}`)
      } else {
        result.creadas += batch.length // Simplificado: Supabase no diferencia INSERT vs UPDATE en upsert
      }
    }

    // 8. Actualizar last_synced_at en fum_sheets_config
    await supabaseClient
      .from('fum_sheets_config')
      .update({ last_synced_at: syncedAt, last_sync_rows: records.length, updated_at: syncedAt })
      .eq('almacen_id', almacen_id)
      .eq('spreadsheet_id', spreadsheet_id)

    return new Response(JSON.stringify(result), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  } catch (err: any) {
    result.errores.push(err.message ?? String(err))
    return new Response(JSON.stringify(result), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})