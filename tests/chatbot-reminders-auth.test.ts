import assert from "node:assert/strict"
import test from "node:test"

import { isAuthorized } from "../app/api/cron/send-reminders/route"

test("acepta Authorization Bearer de Vercel Cron y mantiene compatibilidad manual", () => {
  const previousSecret = process.env.CRON_SECRET
  process.env.CRON_SECRET = "test-cron-secret"

  try {
    assert.equal(
      isAuthorized(
        new Request("https://example.com/api/cron/send-reminders", {
          headers: { authorization: "Bearer test-cron-secret" },
        })
      ),
      true
    )

    assert.equal(
      isAuthorized(
        new Request("https://example.com/api/cron/send-reminders", {
          headers: { "x-cron-secret": "test-cron-secret" },
        })
      ),
      true
    )

    assert.equal(isAuthorized(new Request("https://example.com/api/cron/send-reminders?secret=test-cron-secret")), true)
  } finally {
    if (previousSecret === undefined) {
      delete process.env.CRON_SECRET
    } else {
      process.env.CRON_SECRET = previousSecret
    }
  }
})

test("rechaza requests sin secreto válido", () => {
  const previousSecret = process.env.CRON_SECRET
  process.env.CRON_SECRET = "test-cron-secret"

  try {
    assert.equal(isAuthorized(new Request("https://example.com/api/cron/send-reminders")), false)
    assert.equal(
      isAuthorized(
        new Request("https://example.com/api/cron/send-reminders", {
          headers: { authorization: "Bearer wrong-secret" },
        })
      ),
      false
    )
  } finally {
    if (previousSecret === undefined) {
      delete process.env.CRON_SECRET
    } else {
      process.env.CRON_SECRET = previousSecret
    }
  }
})
