#!/usr/bin/env node
/**
 * Script intelligente: divide il file Claude per DIMENSIONE (max 3MB per file)
 */

const fs = require('fs')
const path = require('path')

const inputFile = process.argv[2]
const maxSizeMB = parseFloat(process.argv[3]) || 3 // Default: 3MB max

if (!inputFile) {
  console.log('Uso: node split-claude-smart.js <path-to-conversations.json> [max-size-MB]')
  process.exit(1)
}

const resolvedPath = inputFile.startsWith('~') 
  ? inputFile.replace('~', process.env.HOME)
  : path.resolve(inputFile)

console.log(`📂 Leggendo: ${resolvedPath}`)
console.log(`📏 Max size per file: ${maxSizeMB}MB`)

const content = fs.readFileSync(resolvedPath, 'utf8')
const data = JSON.parse(content)
const conversations = Array.isArray(data) ? data : data.conversations || []

console.log(`📊 Trovate ${conversations.length} conversazioni`)

// Crea cartella output
const outputDir = path.join(path.dirname(resolvedPath), 'claude-split')
if (fs.existsSync(outputDir)) {
  fs.rmSync(outputDir, { recursive: true })
}
fs.mkdirSync(outputDir, { recursive: true })

const maxSizeBytes = maxSizeMB * 1024 * 1024
let currentBatch = []
let currentSize = 0
let fileNum = 1

function saveBatch() {
  if (currentBatch.length === 0) return
  
  const fileName = `claude-part-${String(fileNum).padStart(2, '0')}.json`
  const filePath = path.join(outputDir, fileName)
  const content = JSON.stringify(currentBatch, null, 2)
  
  fs.writeFileSync(filePath, content)
  const sizeMB = (Buffer.byteLength(content) / 1024 / 1024).toFixed(2)
  console.log(`  ✅ ${fileName} (${currentBatch.length} conv, ${sizeMB}MB)`)
  
  fileNum++
  currentBatch = []
  currentSize = 0
}

for (const conv of conversations) {
  const convStr = JSON.stringify(conv)
  const convSize = Buffer.byteLength(convStr)
  
  // Se questa singola conversazione è troppo grande, salvala da sola
  if (convSize > maxSizeBytes) {
    // Prima salva il batch corrente
    saveBatch()
    
    // Poi salva questa conversazione singola (con warning)
    const fileName = `claude-part-${String(fileNum).padStart(2, '0')}.json`
    const filePath = path.join(outputDir, fileName)
    fs.writeFileSync(filePath, JSON.stringify([conv], null, 2))
    const sizeMB = (convSize / 1024 / 1024).toFixed(2)
    console.log(`  ⚠️  ${fileName} (1 conv GRANDE, ${sizeMB}MB)`)
    fileNum++
    continue
  }
  
  // Se aggiungere questa conversazione supera il limite, salva prima
  if (currentSize + convSize > maxSizeBytes) {
    saveBatch()
  }
  
  currentBatch.push(conv)
  currentSize += convSize
}

// Salva l'ultimo batch
saveBatch()

console.log('')
console.log(`🎉 Fatto! ${fileNum - 1} file creati in: ${outputDir}`)
console.log('')
console.log('⚠️  I file marcati con ⚠️ contengono singole conversazioni molto lunghe.')
console.log('    Puoi provare a caricarli, ma potrebbero causare timeout.')
