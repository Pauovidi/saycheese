import assert from "node:assert/strict"
import test from "node:test"

import {
  DROP_SCHEMA_NOT_INITIALIZED_CODE,
  DROP_STORAGE_UNAVAILABLE_CODE,
  DropStorageUnavailableError,
  classifyDropStorageError,
  isDropArchiveOrSizeStockMissingError,
  isDropPreorderCtaColumnMissingError,
  isDropSchemaMissingError,
  toDropStorageUnavailableError,
} from "../src/data/drop-storage-status"

test("detecta tabla drops ausente en schema cache de PostgREST", () => {
  const error = {
    code: "PGRST205",
    message: "Could not find the table 'public.drops' in the schema cache",
  }

  assert.equal(isDropSchemaMissingError(error), true)
  assert.equal(classifyDropStorageError(error), "NOT_INITIALIZED")

  const normalized = toDropStorageUnavailableError(error, "test")
  assert.equal(normalized.code, DROP_SCHEMA_NOT_INITIALIZED_CODE)
  assert.equal(normalized.status, 503)
  assert.equal(normalized.availability, "NOT_INITIALIZED")
})

test("detecta variaciones de schema cache para columnas y RPC de drops", () => {
  assert.equal(
    isDropSchemaMissingError({
      message: "Could not find the column 'selected_size' of 'order_items' in the schema cache",
    }),
    true
  )
  assert.equal(
    isDropSchemaMissingError({
      message: "Could not find the function public.create_drop_reservation(p_drop_id) in the schema cache",
    }),
    true
  )
  assert.equal(
    isDropSchemaMissingError({
      code: "42883",
      message: "function public.get_drop_stock_summary(uuid) does not exist",
    }),
    true
  )
  const sizeStockRpcError = {
    code: "PGRST202",
    message: "Could not find the function public.get_drop_size_stock_summary(p_drop_id) in the schema cache",
  }
  assert.equal(isDropSchemaMissingError(sizeStockRpcError), true)
  assert.equal(isDropArchiveOrSizeStockMissingError(sizeStockRpcError), true)
  const sizeModeColumnError = {
    code: "PGRST204",
    message: "Could not find the 'size_stock_enabled' column of 'drops' in the schema cache",
  }
  assert.equal(isDropSchemaMissingError(sizeModeColumnError), true)
  assert.equal(isDropArchiveOrSizeStockMissingError(sizeModeColumnError), true)
})

test("no clasifica permisos ni timeouts como schema no inicializado", () => {
  assert.equal(
    isDropSchemaMissingError({
      code: "42501",
      message: "permission denied for table drops",
    }),
    false
  )
  assert.equal(
    isDropSchemaMissingError({
      message: "fetch failed because the connection timed out",
    }),
    false
  )
  assert.equal(
    isDropSchemaMissingError({
      code: "42703",
      message: "column unknown_field does not exist",
    }),
    false
  )

  const normalized = new DropStorageUnavailableError({
    availability: classifyDropStorageError({ message: "fetch failed because the connection timed out" }),
  })
  assert.equal(normalized.code, DROP_STORAGE_UNAVAILABLE_CODE)
  assert.equal(normalized.availability, "UNAVAILABLE")
})

test("detecta solo la columna preorder_cta_text ausente como migración CTA pendiente", () => {
  assert.equal(
    isDropPreorderCtaColumnMissingError({
      message: "Could not find the 'preorder_cta_text' column of 'drops' in the schema cache",
    }),
    true
  )
  assert.equal(
    isDropPreorderCtaColumnMissingError({
      code: "42501",
      message: "permission denied for column preorder_cta_text",
    }),
    false
  )
  assert.equal(
    isDropPreorderCtaColumnMissingError({
      message: "fetch failed because the connection timed out",
    }),
    false
  )
})
