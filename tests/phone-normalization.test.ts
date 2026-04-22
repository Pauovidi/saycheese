import test from "node:test"
import assert from "node:assert/strict"

import { buildPhoneSearchVariants, normalizePhone, normalizePhoneOrNull, phoneDigitsOnly, phoneMatchesSearch } from "../lib/phone"

test("normaliza teléfonos a una única forma compartida", () => {
  assert.equal(phoneDigitsOnly("+34 645 29 04 41"), "34645290441")
  assert.equal(normalizePhone("+34 645 29 04 41"), "645290441")
  assert.equal(normalizePhone("0034 645 29 04 41"), "645290441")
  assert.equal(normalizePhone("645290441"), "645290441")
  assert.equal(normalizePhoneOrNull(""), null)
})

test("genera variantes de búsqueda con y sin prefijo", () => {
  assert.deepEqual(buildPhoneSearchVariants("+34 645 29 04 41"), ["645290441", "34645290441"])
  assert.deepEqual(buildPhoneSearchVariants("645290441"), ["645290441", "34645290441"])
})

test("permite buscar por teléfono con y sin +34 contra valores legacy o normalizados", () => {
  assert.equal(phoneMatchesSearch("+34 645 29 04 41", "645290441"), true)
  assert.equal(phoneMatchesSearch("645290441", "+34 645 29 04 41"), true)
  assert.equal(phoneMatchesSearch("34645290441", "290441"), true)
})
