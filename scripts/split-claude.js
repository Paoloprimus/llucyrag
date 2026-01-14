#!/usr/bin/env node
/**
 * Script per dividere il file conversations.json di Claude in file più piccoli
 * 
 * Uso: node split-claude.js <path-to-conversations.json> [conversations-per-file]
 * 
 * Esempio: node split-claude.js ~/Downloads/conversations.json 50
 */

const fs = require('fs')
const path = require('path')

const inputFile = process.argv[2]
const perFile = parseInt(process.argv[3]) || 50 // Default: 50 conversazioni per file

if (!inputFile) {
  console.log('Uso: node split-claude.js <path-to-conversations.json> [conversations-per-file]')
  console.log('')
  console.log('Esempio: node split-claude.js ~/Downloads/conversations.json 50')
  process.exit(1)
}

// Risolvi path relativo
const resolvedPath = inputFile.startsWith('~') 
  ? inputFile.replace('~', process.env.HOME)
  : path.resolve(inputFile)

console.log(`📂 Leggendo: ${resolvedPath}`)

if (!fs.existsSync(resolvedPath)) {
  console.error(`❌ File non trovato: ${resolvedPath}`)
  process.exit(1)
}

const content = fs.readFileSync(resolvedPath, 'utf8')
let data

try {
  data = JSON.parse(content)
} catch (e) {
  console.error('❌ Errore parsing JSON:', e.message)
  process.exit(1)
}

// Claude export può essere array diretto o { conversations: [...] }
const conversations = Array.isArray(data) ? data : data.conversations || []

console.log(`📊 Trovate ${conversations.length} conversazioni`)

if (conversations.length === 0) {
  console.log('⚠️ Nessuna conversazione trovata')
  process.exit(0)
}

// Crea cartella output
const outputDir = path.join(path.dirname(resolvedPath), 'claude-split')
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

console.log(`📁 Output: ${outputDir}`)

// Dividi in chunks
const totalFiles = Math.ceil(conversations.length / perFile)
console.log(`✂️ Dividendo in ${totalFiles} file (${perFile} conversazioni ciascuno)`)

for (let i = 0; i < conversations.length; i += perFile) {
  const chunk = conversations.slice(i, i + perFile)
  const fileNum = Math.floor(i / perFile) + 1
  const fileName = `claude-part-${String(fileNum).padStart(2, '0')}.json`
  const filePath = path.join(outputDir, fileName)
  
  fs.writeFileSync(filePath, JSON.stringify(chunk, null, 2))
  console.log(`  ✅ ${fileName} (${chunk.length} conversazioni)`)
}

console.log('')
console.log(`🎉 Fatto! ${totalFiles} file creati in: ${outputDir}`)
console.log('')
console.log('Ora puoi caricarli su settings.llucy.it uno alla volta o a gruppi.')
