import { test } from "node:test"
import assert from "node:assert/strict"

import { formatSeconds, formatTimecode, parseDecimal } from "./parse-decimal.ts"

test("parseDecimal accepts dot as decimal separator", () => {
  assert.equal(parseDecimal("1.5"), 1.5)
})

test("parseDecimal accepts comma as decimal separator", () => {
  assert.equal(parseDecimal("1,5"), 1.5)
})

test("parseDecimal accepts leading zeros", () => {
  assert.equal(parseDecimal("05"), 5)
})

test("parseDecimal accepts comma with trailing zero", () => {
  assert.equal(parseDecimal("2,50"), 2.5)
})

test("parseDecimal trims whitespace", () => {
  assert.equal(parseDecimal(" 1.5 "), 1.5)
})

test("parseDecimal returns null for empty string", () => {
  assert.equal(parseDecimal(""), null)
})

test("parseDecimal returns null for letters", () => {
  assert.equal(parseDecimal("abc"), null)
})

test("parseDecimal keeps a leading minus for the clamp to handle", () => {
  assert.equal(parseDecimal("-5"), -5)
})

test("parseDecimal rejects two decimal separators", () => {
  assert.equal(parseDecimal("1.2.3"), null)
})

test("formatTimecode uses pt-BR comma for tenths", () => {
  assert.equal(formatTimecode(2.5), "0:02,5")
})

test("formatTimecode formats whole minutes", () => {
  assert.equal(formatTimecode(65), "1:05")
})

test("formatSeconds rounds to one decimal with a comma", () => {
  assert.equal(formatSeconds(17.588995), "17,6")
  assert.equal(formatSeconds(14.088), "14,1")
  assert.equal(formatSeconds(4), "4")
  assert.equal(formatSeconds(0.5), "0,5")
})

test("formatSeconds never strips the decimal into a long integer", () => {
  const shown = formatSeconds(17.588995)
  assert.equal(shown.includes("17588995"), false)
  assert.match(shown, /^\d+(,\d)?$/)
})
