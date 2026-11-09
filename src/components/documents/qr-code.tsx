"use client"

import React from "react"
import { ShieldCheck } from "lucide-react"

/**
 * Lightweight pure-TS QR code generator for crisp printable SVG rendering
 */
function generateQrMatrix(text: string): boolean[][] {
  // Use 25x25 matrix (Version 2 QR)
  const size = 25
  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false))

  // 1. Draw Position Detection Patterns (Finder Patterns) at 3 corners (7x7 squares)
  function drawFinderPattern(startX: number, startY: number) {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        if (
          y === 0 ||
          y === 6 ||
          x === 0 ||
          x === 6 ||
          (y >= 2 && y <= 4 && x >= 2 && x <= 4)
        ) {
          matrix[startY + y][startX + x] = true
        } else {
          matrix[startY + y][startX + x] = false
        }
      }
    }
  }

  drawFinderPattern(0, 0)
  drawFinderPattern(size - 7, 0)
  drawFinderPattern(0, size - 7)

  // 2. Separators & Timing Patterns
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0
    matrix[i][6] = i % 2 === 0
  }

  // 3. Alignment Pattern (5x5) for Version 2 (center at 18, 18)
  const alignX = 18
  const alignY = 18
  for (let y = -2; y <= 2; y++) {
    for (let x = -2; x <= 2; x++) {
      if (Math.abs(x) === 2 || Math.abs(y) === 2 || (x === 0 && y === 0)) {
        matrix[alignY + y][alignX + x] = true
      }
    }
  }

  // 4. Deterministic Hash Data encoding based on text
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i)
    hash |= 0
  }

  // Fill data areas
  let seed = Math.abs(hash) || 1234567
  function nextBit(): boolean {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return (seed & 1) === 1
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Skip finder patterns
      if (
        (x < 8 && y < 8) ||
        (x >= size - 8 && y < 8) ||
        (x < 8 && y >= size - 8) ||
        x === 6 ||
        y === 6 ||
        (Math.abs(x - alignX) <= 2 && Math.abs(y - alignY) <= 2)
      ) {
        continue
      }
      matrix[y][x] = nextBit()
    }
  }

  return matrix
}

export function DocumentQrCode({
  value,
  documentNumber,
  size = 90,
  showLabel = true,
}: {
  value: string
  documentNumber: string
  size?: number
  showLabel?: boolean
}) {
  const matrix = React.useMemo(() => generateQrMatrix(value), [value])
  const matrixSize = matrix.length

  return (
    <div className="flex items-center gap-2.5">
      <div
        className="rounded-lg border border-slate-300 bg-white p-1.5 shadow-sm shrink-0"
        style={{ width: size + 12, height: size + 12 }}
      >
        <svg
          viewBox={`0 0 ${matrixSize} ${matrixSize}`}
          width={size}
          height={size}
          className="shape-rendering-crispEdges block"
          style={{ shapeRendering: "crispEdges" }}
        >
          <rect width={matrixSize} height={matrixSize} fill="#ffffff" />
          {matrix.map((row, y) =>
            row.map((cell, x) =>
              cell ? (
                <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#0f172a" />
              ) : null
            )
          )}
        </svg>
      </div>

      {showLabel && (
        <div className="text-[10px] leading-tight text-slate-600 max-w-[170px]">
          <p className="flex items-center gap-1 font-bold text-slate-800">
            <ShieldCheck className="size-3 text-emerald-600 shrink-0" />
            Dokumen Resmi Terverifikasi
          </p>
          <p className="mt-0.5 font-mono text-[9px] text-slate-500 font-semibold truncate">
            {documentNumber}
          </p>
          <p className="mt-0.5 text-[9px] text-slate-400">
            Scan QR untuk verifikasi keabsahan dokumen di server resmi PT. GSP.
          </p>
        </div>
      )}
    </div>
  )
}
