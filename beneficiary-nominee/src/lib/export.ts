function escapeCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number>>,
): void {
  const content = [headers, ...rows]
    .map((row) => row.map(escapeCell).join(','))
    .join('\r\n')
  const blob = new Blob([`\uFEFF${content}`], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function printReport(): void {
  window.print()
}
