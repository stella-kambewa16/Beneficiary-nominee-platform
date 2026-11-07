import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentLoadingTask, RenderTask } from 'pdfjs-dist'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
// Power Apps Code Apps enforce a strict CSP (worker-src 'none'), so we cannot
// create a web worker or lazily import a separate chunk at runtime. Importing
// the worker statically sets `globalThis.pdfjsWorker`, which makes pdf.js run
// on the main thread via a loopback port. This is what keeps the preview
// working in the published app as well as in local development.
import 'pdfjs-dist/legacy/build/pdf.worker.min.mjs'
import { decodePdfDataUri } from '../lib/pdf'

export function PdfPreview({
  dataUri,
  onReadyChange,
}: {
  dataUri: string
  onReadyChange?: (ready: boolean) => void
}) {
  const pagesRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let loadingTask: PDFDocumentLoadingTask | null = null
    const renderTasks: RenderTask[] = []

    const renderPdf = async () => {
      setLoading(true)
      setError(null)
      onReadyChange?.(false)
      pagesRef.current?.replaceChildren()

      try {
        const bytes = decodePdfDataUri(dataUri)
        loadingTask = pdfjs.getDocument({
          data: bytes,
          isEvalSupported: false,
        })
        const document = await loadingTask.promise
        const container = pagesRef.current
        if (!container) return

        for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
          if (cancelled) return
          const page = await document.getPage(pageNumber)
          const baseViewport = page.getViewport({ scale: 1 })
          const scale = Math.min(
            1.5,
            Math.max(0.5, (container.clientWidth - 32) / baseViewport.width),
          )
          const viewport = page.getViewport({ scale })
          const outputScale = window.devicePixelRatio || 1
          const canvas = window.document.createElement('canvas')
          canvas.className = 'pdf-preview-page'
          canvas.setAttribute('aria-label', `PDF page ${pageNumber}`)
          canvas.width = Math.floor(viewport.width * outputScale)
          canvas.height = Math.floor(viewport.height * outputScale)
          canvas.style.width = `${Math.floor(viewport.width)}px`
          canvas.style.height = `${Math.floor(viewport.height)}px`
          const context = canvas.getContext('2d')
          if (!context) {
            throw new Error('The browser could not create a PDF preview canvas.')
          }

          container.append(canvas)
          const renderTask = page.render({
            canvas,
            canvasContext: context,
            viewport,
            transform:
              outputScale === 1
                ? undefined
                : [outputScale, 0, 0, outputScale, 0, 0],
          })
          renderTasks.push(renderTask)
          await renderTask.promise
        }

        if (!cancelled) onReadyChange?.(true)
      } catch (renderError) {
        if (!cancelled) {
          onReadyChange?.(false)
          setError(
            renderError instanceof Error
              ? renderError.message
              : 'The PDF could not be rendered.',
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void renderPdf()

    return () => {
      cancelled = true
      onReadyChange?.(false)
      renderTasks.forEach((task) => task.cancel())
      if (loadingTask) {
        void loadingTask.destroy().catch((destroyError: unknown) => {
          console.error('Could not release the PDF preview document.', destroyError)
        })
      }
    }
  }, [dataUri, onReadyChange])

  return (
    <div className="pdf-preview-scroll" aria-busy={loading}>
      {loading ? (
        <p className="pdf-preview-state" role="status">
          Preparing PDF preview…
        </p>
      ) : null}
      {error ? (
        <div className="pdf-preview-state is-error" role="alert">
          <p className="empty-title">PDF preview unavailable</p>
          <p>{error}</p>
        </div>
      ) : null}
      <div className="pdf-preview-pages" ref={pagesRef} />
    </div>
  )
}
