export type DropModuleAvailability = "READY" | "NOT_INITIALIZED" | "UNAVAILABLE"

export const DROP_SCHEMA_NOT_INITIALIZED_CODE = "DROP_SCHEMA_NOT_INITIALIZED"
export const DROP_STORAGE_UNAVAILABLE_CODE = "DROP_STORAGE_UNAVAILABLE"
export const DROP_CTA_MIGRATION_REQUIRED_CODE = "DROP_CTA_MIGRATION_REQUIRED"
export const DROP_ARCHIVE_SIZE_STOCK_MIGRATION_REQUIRED_CODE = "DROP_ARCHIVE_SIZE_STOCK_MIGRATION_REQUIRED"

type ErrorLike = {
  code?: unknown
  message?: unknown
  details?: unknown
  hint?: unknown
  status?: unknown
}

function readErrorField(error: unknown, field: keyof ErrorLike) {
  if (!error || typeof error !== "object") return undefined
  const value = (error as ErrorLike)[field]
  return typeof value === "string" || typeof value === "number" ? String(value) : undefined
}

export function getDropStorageErrorCode(error: unknown) {
  return readErrorField(error, "code")
}

export function getDropStorageErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return readErrorField(error, "message") ?? String(error)
}

function getSearchableErrorText(error: unknown) {
  return [
    getDropStorageErrorCode(error),
    getDropStorageErrorMessage(error),
    readErrorField(error, "details"),
    readErrorField(error, "hint"),
    readErrorField(error, "status"),
  ]
    .filter(Boolean)
    .join(" ")
}

export function isDropSchemaMissingError(error: unknown) {
  const code = getDropStorageErrorCode(error)?.toUpperCase()
  if (code && ["PGRST204", "PGRST205"].includes(code)) {
    return true
  }

  const text = getSearchableErrorText(error)
  return [
    /could\s+not\s+find\s+the\s+(?:table|function|column).*?(?:drops|drop_reservations|drop_revisions|drop_size_stock|drop_id|customer_name|phone|selected_size|selected_color|archived_at|archived_by|archive_reason|size_stock_enabled|preorder_limit|is_active).*?schema\s+cache/i,
    /(?:relation|table)\s+["']?(?:public\.)?(?:drops|drop_reservations|drop_revisions|drop_size_stock)["']?\s+does\s+not\s+exist/i,
    /function\s+(?:public\.)?(?:get_drop_stock_summary|get_drop_size_stock_summary|create_drop_reservation|create_drop_preorder|cancel_drop_reservation|create_order_with_items)\b.*does\s+not\s+exist/i,
    /column\s+["']?(?:drop_id|product_name|unit_price|selected_size|selected_color)["']?\s+(?:of\s+relation\s+["']?order_items["']?\s+)?does\s+not\s+exist/i,
    /faltan\s+variables\s+supabase/i,
  ].some((pattern) => pattern.test(text))
}

export function isDropPreorderCtaColumnMissingError(error: unknown) {
  const text = getSearchableErrorText(error)
  return /preorder_cta_text/i.test(text) && /schema\s+cache|does\s+not\s+exist|not\s+found/i.test(text)
}

export function isDropPreorderLimitColumnMissingError(error: unknown) {
  const text = getSearchableErrorText(error)
  return /preorder_limit/i.test(text) && /schema\s+cache|does\s+not\s+exist|not\s+found/i.test(text)
}

export function isDropArchiveOrSizeStockMissingError(error: unknown) {
  const text = getSearchableErrorText(error)
  return /archived_at|archived_by|archive_reason|drop_size_stock|get_drop_size_stock_summary|size_stock|size_stock_enabled|is_active/i.test(text) && /schema\s+cache|does\s+not\s+exist|not\s+found/i.test(text)
}

export function classifyDropStorageError(error: unknown): Exclude<DropModuleAvailability, "READY"> {
  return isDropSchemaMissingError(error) ? "NOT_INITIALIZED" : "UNAVAILABLE"
}

export class DropStorageUnavailableError extends Error {
  readonly code: string
  readonly availability: Exclude<DropModuleAvailability, "READY">
  readonly status: number
  readonly originalCode?: string

  constructor(input: {
    availability: Exclude<DropModuleAvailability, "READY">
    message?: string
    originalCode?: string
  }) {
    super(
      input.message ??
        (input.availability === "NOT_INITIALIZED"
          ? "El módulo de Drops todavía no está inicializado en este entorno."
          : "El módulo de Drops no está disponible temporalmente.")
    )
    this.name = "DropStorageUnavailableError"
    this.availability = input.availability
    this.code = input.availability === "NOT_INITIALIZED" ? DROP_SCHEMA_NOT_INITIALIZED_CODE : DROP_STORAGE_UNAVAILABLE_CODE
    this.status = 503
    this.originalCode = input.originalCode
  }
}

export class DropCtaMigrationRequiredError extends Error {
  readonly code = DROP_CTA_MIGRATION_REQUIRED_CODE
  readonly status = 503

  constructor() {
    super("La migración del CTA de Drops todavía no está aplicada en este entorno.")
    this.name = "DropCtaMigrationRequiredError"
  }
}

export class DropArchiveSizeStockMigrationRequiredError extends Error {
  readonly code = DROP_ARCHIVE_SIZE_STOCK_MIGRATION_REQUIRED_CODE
  readonly status = 503

  constructor() {
    super("La migración de archivado y stock por talla de Drops todavía no está aplicada en este entorno.")
    this.name = "DropArchiveSizeStockMigrationRequiredError"
  }
}

const loggedDropStorageIssues = new Set<string>()

export function logDropStorageIssueOnce(input: {
  module?: "drops"
  operation: string
  availability: Exclude<DropModuleAvailability, "READY">
  error: unknown
}) {
  const code = getDropStorageErrorCode(input.error)
  const key = `${input.module ?? "drops"}:${input.operation}:${input.availability}:${code ?? "no-code"}`
  if (loggedDropStorageIssues.has(key)) return
  loggedDropStorageIssues.add(key)

  const logPayload = {
    module: input.module ?? "drops",
    operation: input.operation,
    availability: input.availability,
    code,
  }

  if (input.availability === "NOT_INITIALIZED") {
    console.warn("drop_storage_not_initialized", logPayload)
    return
  }

  console.error("drop_storage_unavailable", logPayload)
}

export function toDropStorageUnavailableError(error: unknown, operation: string) {
  const availability = classifyDropStorageError(error)
  logDropStorageIssueOnce({ operation, availability, error })
  return new DropStorageUnavailableError({
    availability,
    originalCode: getDropStorageErrorCode(error),
  })
}

export function getDropAdminUnavailableMessage(availability: Exclude<DropModuleAvailability, "READY">) {
  return availability === "NOT_INITIALIZED"
    ? "La migración de Drops todavía no está aplicada en este entorno."
    : "El módulo de Drops no está disponible temporalmente. Vuelve a intentarlo más tarde."
}
