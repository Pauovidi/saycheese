import test from "node:test"
import assert from "node:assert/strict"

import {
  buildGroupedProductionDetails,
  buildProductionCopyText,
  buildProductionFlavorSummary,
  getProductionEntryLine,
  resolveCanonicalFlavorLabel,
} from "../lib/admin/production-presentation"

const catalogFlavors = [
  { category: "clasica", label: "Clásica" },
  { category: "gofio", label: "Gofio" },
  { category: "hippo", label: "Hippo" },
  { category: "polvito-uruguayo", label: "Polvito Uruguayo" },
]

test("agrupa producción por teléfono aunque llegue con y sin +34", () => {
  const groups = buildGroupedProductionDetails(
    [
      {
        orderId: "1",
        type: "cake",
        flavor: "clasica",
        qty: 1,
        phone: "+34 626 54 22 44",
        customerName: "Ana",
        deliveryDate: "2026-04-22",
        createdAt: "2026-04-20T10:00:00.000Z",
      },
      {
        orderId: "2",
        type: "box",
        flavor: "hippo",
        qty: 1,
        phone: "626542244",
        customerName: "Ana",
        deliveryDate: "2026-04-22",
        createdAt: "2026-04-20T10:05:00.000Z",
      },
    ],
    catalogFlavors
  )

  assert.equal(groups.length, 1)
  assert.equal(groups[0]?.label, "Ana · 626542244")
  assert.deepEqual(
    groups[0]?.entries.map((entry) => `${entry.type}:${entry.flavor}:${entry.qty}`),
    ["cake:Clásica:1", "box:Hippo:1"]
  )
})

test("muestra nombre y teléfono, con fallback al teléfono si no hay nombre", () => {
  const groups = buildGroupedProductionDetails(
    [
      {
        orderId: "1",
        type: "cake",
        flavor: "clasica",
        qty: 1,
        phone: "626542244",
        customerName: "Ana",
        deliveryDate: "2026-04-22",
        createdAt: "2026-04-20T10:00:00.000Z",
      },
      {
        orderId: "2",
        type: "cake",
        flavor: "gofio",
        qty: 1,
        phone: "664148555",
        customerName: null,
        deliveryDate: "2026-04-22",
        createdAt: "2026-04-20T10:05:00.000Z",
      },
    ],
    catalogFlavors
  )

  assert.deepEqual(
    groups.map((group) => group.label),
    ["Ana · 626542244", "664148555"]
  )
})

test("normaliza visualmente el sabor a su etiqueta canónica del catálogo", () => {
  assert.equal(resolveCanonicalFlavorLabel("gofio", catalogFlavors), "Gofio")
  assert.equal(resolveCanonicalFlavorLabel("polvito uruguayo", catalogFlavors), "Polvito Uruguayo")
})

test("resume producción por tipo y sabor ordenando por cantidad y sabor", () => {
  const summary = buildProductionFlavorSummary(
    [
      {
        orderId: "1",
        type: "box",
        flavor: "hippo",
        qty: 1,
        phone: "626542244",
        customerName: "Ana",
        deliveryDate: "2026-04-22",
        createdAt: "2026-04-20T10:00:00.000Z",
      },
      {
        orderId: "2",
        type: "cake",
        flavor: "gofio",
        qty: 2,
        phone: "626542244",
        customerName: "Ana",
        deliveryDate: "2026-04-22",
        createdAt: "2026-04-20T10:05:00.000Z",
      },
      {
        orderId: "3",
        type: "cake",
        flavor: "clasica",
        qty: 2,
        phone: "664148555",
        customerName: "Luis",
        deliveryDate: "2026-04-22",
        createdAt: "2026-04-20T10:10:00.000Z",
      },
      {
        orderId: "4",
        type: "box",
        flavor: "hippo",
        qty: 3,
        phone: "664148555",
        customerName: "Luis",
        deliveryDate: "2026-04-22",
        createdAt: "2026-04-20T10:15:00.000Z",
      },
    ],
    catalogFlavors
  )

  assert.deepEqual(summary, [
    {
      type: "cake",
      label: "Grandes",
      entries: [
        { flavor: "Clásica", qty: 2 },
        { flavor: "Gofio", qty: 2 },
      ],
    },
    {
      type: "box",
      label: "Cajitas",
      entries: [{ flavor: "Hippo", qty: 4 }],
    },
  ])
})

test("muestra cajitas como Cajita en las líneas de producción", () => {
  assert.equal(getProductionEntryLine({ type: "box", flavor: "Gofio", qty: 2 }), "Cajita · Gofio 🌾 — 2")
})

test("genera el texto copiado agrupado por teléfono y con formato unificado", () => {
  const groups = buildGroupedProductionDetails(
    [
      {
        orderId: "1",
        type: "cake",
        flavor: "clasica",
        qty: 1,
        phone: "626542244",
        customerName: "Ana",
        deliveryDate: "2026-04-22",
        createdAt: "2026-04-20T10:00:00.000Z",
      },
      {
        orderId: "2",
        type: "cake",
        flavor: "gofio",
        qty: 1,
        phone: "626542244",
        customerName: "Ana",
        deliveryDate: "2026-04-22",
        createdAt: "2026-04-20T10:02:00.000Z",
      },
      {
        orderId: "3",
        type: "box",
        flavor: "hippo",
        qty: 1,
        phone: "626542244",
        customerName: "Ana",
        deliveryDate: "2026-04-22",
        createdAt: "2026-04-20T10:03:00.000Z",
      },
      {
        orderId: "4",
        type: "cake",
        flavor: "polvito uruguayo",
        qty: 1,
        phone: "664148555",
        customerName: "Luis",
        deliveryDate: "2026-04-22",
        createdAt: "2026-04-20T10:04:00.000Z",
      },
    ],
    catalogFlavors
  )
  const summaryByType = buildProductionFlavorSummary(
    [
      {
        orderId: "1",
        type: "cake",
        flavor: "clasica",
        qty: 1,
        phone: "626542244",
        customerName: "Ana",
        deliveryDate: "2026-04-22",
        createdAt: "2026-04-20T10:00:00.000Z",
      },
      {
        orderId: "2",
        type: "cake",
        flavor: "gofio",
        qty: 1,
        phone: "626542244",
        customerName: "Ana",
        deliveryDate: "2026-04-22",
        createdAt: "2026-04-20T10:02:00.000Z",
      },
      {
        orderId: "3",
        type: "box",
        flavor: "hippo",
        qty: 1,
        phone: "626542244",
        customerName: "Ana",
        deliveryDate: "2026-04-22",
        createdAt: "2026-04-20T10:03:00.000Z",
      },
      {
        orderId: "4",
        type: "cake",
        flavor: "polvito uruguayo",
        qty: 1,
        phone: "664148555",
        customerName: "Luis",
        deliveryDate: "2026-04-22",
        createdAt: "2026-04-20T10:04:00.000Z",
      },
    ],
    catalogFlavors
  )

  const copy = buildProductionCopyText({
    rangeLabel: "22/04/2026 → 22/04/2026",
    totals: { cakes: 3, boxes: 1 },
    summaryByType,
    groups,
  })

  assert.equal(
    copy,
    [
      "Rango: 22/04/2026 → 22/04/2026",
      "",
      "TARTAS GRANDES (3)",
      "CAJITAS (1)",
      "",
      "RESUMEN POR SABOR",
      "Grandes:",
      "1 Clásica",
      "1 Gofio",
      "1 Polvito Uruguayo",
      "",
      "Cajitas:",
      "1 Hippo",
      "",
      "DETALLE",
      "Ana · 626542244:",
      "Tarta grande · Clásica 🍰 — 1",
      "Tarta grande · Gofio 🌾 — 1",
      "Cajita · Hippo 🦛 — 1",
      "",
      "Luis · 664148555:",
      "Tarta grande · Polvito Uruguayo ✨ — 1",
    ].join("\n")
  )
})
