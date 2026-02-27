/**
 * googleSheetsSync.ts — Servicio de sincronización con Google Sheets
 * Agrícola Moray ERP — FASE 2 ✅ IMPLEMENTADO
 *
 * ── FLUJO ──────────────────────────────────────────────────────────────────
 * 1. Usuario abre SyncSheetsModal → configura el Spreadsheet ID si es la 1ª vez
 * 2. Clic en "Sincronizar" → syncFromSheets()
 * 3. Se llama a la Edge Function 'sheets-sync' via supabase.functions.invoke()
 * 4. La Edge Function autentica con Google (Service Account), lee el Sheet,
 *    y hace UPSERT en fum_programa usando sheets_sync_id como clave única
 * 5. La respuesta llega al modal con { creadas, actualizadas, sin_cambios, errores }
 *
 * ── CONFIGURACIÓN REQUERIDA ─────────────────────────────────────────────────
 * 1. En Supabase Dashboard → Settings → Edge Functions → Secrets:
 *    - GOOGLE_SERVICE_ACCOUNT_JSON = {JSON completo de la Service Account}
 * 2. Compartir el Google Sheets con el email de la Service Account (Lector)
 * 3. Guardar el Spreadsheet ID en fum_sheets_config vía SyncSheetsModal
 *
 * ── CÓMO OBTENER EL SPREADSHEET_ID ─────────────────────────────────────────
 * URL del sheet: https://docs.google.com/spreadsheets/d/[ESTE_ES_EL_ID]/edit
 */

import { supabase } from '../lib/supabaseClient'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface SyncResult {
  creadas: number
  actualizadas: number
  sin_cambios: number
  errores: string[]
  synced_at: string
  total_filas_leidas?: number
  dry_run?: boolean
}

export interface SheetsConfig {
  id: string
  almacen_id: string
  spreadsheet_id: string
  sheet_name: string
  data_start_row: number
  last_synced_at: string | null
  last_sync_rows: number | null
  activo: boolean
}

export interface SyncOptions {
  almacenId: string
  spreadsheetId: string
  sheetName?: string
  dataStartRow?: number
  dryRun?: boolean
  /** Solo importa filas donde Col A (Semana) == este número */
  filterSemana?: number
}

// ── Configuración ─────────────────────────────────────────────────────────────

export async function getSheetsConfig(almacenId: string): Promise<SheetsConfig | null> {
  const { data, error } = await supabase
    .from('fum_sheets_config')
    .select('*')
    .eq('almacen_id', almacenId)
    .eq('activo', true)
    .maybeSingle()

  if (error) { console.error('getSheetsConfig error:', error); return null }
  return data as SheetsConfig | null
}

export async function saveSheetsConfig(
  almacenId: string,
  config: { spreadsheetId: string; sheetName: string; dataStartRow: number }
): Promise<void> {
  const { error } = await supabase
    .from('fum_sheets_config')
    .upsert({
      almacen_id: almacenId,
      spreadsheet_id: config.spreadsheetId,
      sheet_name: config.sheetName,
      data_start_row: config.dataStartRow,
      activo: true,
    }, { onConflict: 'almacen_id' })

  if (error) throw error
}

// ── Sync principal ────────────────────────────────────────────────────────────

export async function syncFromSheets(
  options: SyncOptions,
  onComplete?: () => void
): Promise<SyncResult> {
  const { almacenId, spreadsheetId, sheetName = 'Programa', dataStartRow = 2, dryRun = false, filterSemana } = options

  const { data, error } = await supabase.functions.invoke('sheets-sync', {
    body: {
      almacen_id: almacenId,
      spreadsheet_id: spreadsheetId,
      sheet_name: sheetName,
      data_start_row: dataStartRow,
      dry_run: dryRun,
      ...(filterSemana != null ? { filter_semana: filterSemana } : {}),
    },
  })

  if (error) {
    const detail = typeof error === 'object' && 'context' in error
      ? await (error as any).context?.json?.()
      : null
    throw new Error(
      detail?.errores?.[0] ?? (error as any).message ?? 'Error invocando sheets-sync'
    )
  }

  const result = data as SyncResult
  onComplete?.()
  return result
}

/**
 * Extrae el Spreadsheet ID desde una URL completa o lo retorna directamente.
 * URL: https://docs.google.com/spreadsheets/d/[ID]/edit
 */
export function extractSpreadsheetId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim()
  if (!trimmed.includes('/')) return trimmed.length > 10 ? trimmed : null
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  return match?.[1] ?? null
}