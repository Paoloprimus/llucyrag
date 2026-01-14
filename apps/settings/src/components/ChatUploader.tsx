'use client'

import { useState, useRef } from 'react'

interface ChatUploaderProps {
  userId: string
  userEmail: string
  onComplete: () => void
}

type UploadStatus = 'idle' | 'processing' | 'success' | 'error'

export function ChatUploader({ userId, userEmail, onComplete }: ChatUploaderProps) {
  const [files, setFiles] = useState<File[]>([])
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [progress, setProgress] = useState({ processed: 0, total: 0, chunks: 0 })
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    const validFiles = selectedFiles.filter(
      f => f.name.endsWith('.md') || f.name.endsWith('.json')
    )
    setFiles(prev => [...prev, ...validFiles])
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const droppedFiles = Array.from(e.dataTransfer.files)
    const validFiles = droppedFiles.filter(
      f => f.name.endsWith('.md') || f.name.endsWith('.json')
    )
    setFiles(prev => [...prev, ...validFiles])
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const startUpload = async () => {
    if (files.length === 0) return

    setStatus('processing')
    setProgress({ processed: 0, total: files.length, chunks: 0 })
    setError('')

    try {
      let totalChunks = 0
      
      // Processa file uno alla volta per evitare payload troppo grandi
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const content = await file.text()
        
        setProgress(prev => ({ ...prev, processed: i + 1 }))
        
        // Se il file è troppo grande (>2MB), skippa con warning
        if (content.length > 2 * 1024 * 1024) {
          console.warn(`File ${file.name} troppo grande, skipping...`)
          continue
        }

        // Invia singolo file al backend
        const response = await fetch('/api/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            files: [{ content, filename: file.name }], 
            userId,
            userEmail,
          }),
        })

        const result = await response.json()

        if (!response.ok || !result.success) {
          console.error(`Errore file ${file.name}:`, result.error)
          continue // Continua con gli altri file
        }

        totalChunks += result.chunksCreated || 0
      }

      setProgress(prev => ({ ...prev, chunks: totalChunks }))
      
      if (totalChunks > 0) {
        setStatus('success')
        onComplete()
      } else {
        throw new Error('Nessun file processato correttamente')
      }

    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Errore sconosciuto')
    }
  }

  return (
    <div className="card">
      <h3 className="font-medium mb-4">Carica conversazioni</h3>

      {status === 'idle' && (
        <>
          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-[var(--border)] rounded-lg p-8 
                       text-center cursor-pointer hover:border-[var(--accent-muted)] 
                       transition-colors"
          >
            <div className="text-3xl mb-2">📁</div>
            <p className="text-sm text-[var(--text-muted)]">
              Trascina qui i file o clicca per selezionarli
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Supportati: .md (ChatGPT, Gemini, Deepseek) e .json (Claude)
            </p>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".md,.json"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* File list */}
          {files.length > 0 && (
            <div className="mt-4">
              <div className="text-sm font-medium mb-2">
                {files.length} file selezionati
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {files.map((file, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-sm 
                               bg-[var(--bg)] p-2 rounded"
                  >
                    <span className="truncate">{file.name}</span>
                    <button
                      onClick={() => removeFile(i)}
                      className="text-[var(--text-muted)] hover:text-[var(--error)] ml-2"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={startUpload}
                className="btn btn-primary w-full mt-4"
              >
                Carica e processa
              </button>
            </div>
          )}
        </>
      )}

      {status === 'processing' && (
        <div className="text-center py-8">
          <div className="text-3xl mb-4 animate-pulse">⏳</div>
          <p className="font-medium">Elaborazione in corso...</p>
          <p className="text-sm text-[var(--text-muted)] mt-2">
            File: {progress.processed} / {progress.total}
          </p>
        </div>
      )}

      {status === 'success' && (
        <div className="text-center py-8">
          <div className="text-3xl mb-4">✅</div>
          <p className="font-medium text-[var(--success)]">Completato!</p>
          <p className="text-sm text-[var(--text-muted)] mt-2">
            {progress.chunks} memorie create
          </p>
          <button
            onClick={() => {
              setStatus('idle')
              setFiles([])
            }}
            className="btn btn-secondary mt-4"
          >
            Carica altri file
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="text-center py-8">
          <div className="text-3xl mb-4">❌</div>
          <p className="font-medium text-[var(--error)]">Errore</p>
          <p className="text-sm text-[var(--text-muted)] mt-2">{error}</p>
          <button
            onClick={() => setStatus('idle')}
            className="btn btn-secondary mt-4"
          >
            Riprova
          </button>
        </div>
      )}
    </div>
  )
}
