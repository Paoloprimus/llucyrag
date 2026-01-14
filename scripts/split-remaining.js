#!/usr/bin/env node
/**
 * Spezza i file rimasti a metà
 */

const fs = require('fs')
const path = require('path')

const inputDir = '/Users/paolo.olivato/Desktop/chat.me/claude chat/claude-split'
const outputDir = '/Users/paolo.olivato/Desktop/chat.me/claude chat/claude-split-small'

// Crea output dir
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.json'))

console.log(`📂 Trovati ${files.length} file da spezzare`)

let outputNum = 1

for (const file of files) {
  const filePath = path.join(inputDir, file)
  const content = fs.readFileSync(filePath, 'utf8')
  const conversations = JSON.parse(content)
  
  const mid = Math.ceil(conversations.length / 2)
  const part1 = conversations.slice(0, mid)
  const part2 = conversations.slice(mid)
  
  // Salva parte 1
  const file1 = `claude-small-${String(outputNum).padStart(2, '0')}.json`
  fs.writeFileSync(path.join(outputDir, file1), JSON.stringify(part1, null, 2))
  const size1 = (fs.statSync(path.join(outputDir, file1)).size / 1024 / 1024).toFixed(2)
  console.log(`  ✅ ${file1} (${part1.length} conv, ${size1}MB)`)
  outputNum++
  
  // Salva parte 2 (se non vuota)
  if (part2.length > 0) {
    const file2 = `claude-small-${String(outputNum).padStart(2, '0')}.json`
    fs.writeFileSync(path.join(outputDir, file2), JSON.stringify(part2, null, 2))
    const size2 = (fs.statSync(path.join(outputDir, file2)).size / 1024 / 1024).toFixed(2)
    console.log(`  ✅ ${file2} (${part2.length} conv, ${size2}MB)`)
    outputNum++
  }
}

console.log('')
console.log(`🎉 Fatto! ${outputNum - 1} file creati in: ${outputDir}`)
