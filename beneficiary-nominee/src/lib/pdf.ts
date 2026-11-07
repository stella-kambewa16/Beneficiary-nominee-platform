const PDF_DATA_URI = /^data:application\/pdf(?:;[a-z0-9=+-]+)*,/i

export function isPdfDataUri(value: string): boolean {
  return PDF_DATA_URI.test(value.trim())
}

export function decodePdfDataUri(dataUri: string): Uint8Array<ArrayBuffer> {
  const trimmed = dataUri.trim()
  const comma = trimmed.indexOf(',')
  if (comma < 0 || !PDF_DATA_URI.test(trimmed.slice(0, comma + 1))) {
    throw new Error('The saved PDF preview is not a valid PDF data URI.')
  }

  const metadata = trimmed.slice(0, comma)
  const payload = trimmed.slice(comma + 1)
  if (/;base64$/i.test(metadata)) {
    const binary = window.atob(payload.replace(/\s/g, ''))
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index)
    }
    return bytes
  }

  return new TextEncoder().encode(decodeURIComponent(payload))
}

export function pdfDataUriToBlob(dataUri: string): Blob {
  return new Blob([decodePdfDataUri(dataUri)], { type: 'application/pdf' })
}
