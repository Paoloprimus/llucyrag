#!/usr/bin/env node
/**
 * Spezza conversazioni singole troppo grandi
 */

const fs = require('fs')
const path = require('path')

const dir = '/Users/paolo.olivato/Desktop/chat.me/claude chat/claude-split-small'

// File da spezzare
const bigFiles = ['claude-small-15.json', 'claude-small-22.json']

for (const file of bigFiles) {
  const filePath = path.join(dir, file)
  if (!fs.existsSync(filePath)) continue
  
  const content = fs.readFileSync(filePath, 'utf8')
  const conversations = JSON.parse(content)
  
  if (conversations.length !== 1) {
    console.log(`⚠️ ${file} ha ${conversations.length} conversazioni, skip`)
    continue
  }
  
  const conv = conversations[0]
  const messages = conv.chat_messages || conv.messages || []
  
  console.log(`📂 ${file}: ${messages.length} messaggi`)
  
  // Dividi i messaggi a metà
  const mid = Math.ceil(messages.length / 2)
  const msgs1 = messages.slice(0, mid)
  const msgs2 = messages.slice(mid)
  
  // Crea due conversazioni
  const conv1 = { ...conv, chat_messages: msgs1, name: conv.name + ' (parte 1)' }
  const conv2 = { ...conv, uuid: conv.uuid + '-p2', chat_messages: msgs2, name: conv.name + ' (parte 2)' }
  
  // Sovrascrivi file originale con parte 1
  fs.writeFileSync(filePath, JSON.stringify([conv1], null, 2))
  const size1 = (fs.statSync(filePath).size / 1024 / 1024).toFixed(2)
  console.log(`  ✅ ${file} riscritto (${msgs1.length} msg, ${size1}MB)`)
  
  // Crea nuovo file per parte 2
  const newFile = file.replace('.json', '-b.json')
  const newPath = path.join(dir, newFile)
  fs.writeFileSync(newPath, JSON.stringify([conv2], null, 2))
  const size2 = (fs.statSync(newPath).size / 1024 / 1024).toFixed(2)
  console.log(`  ✅ ${newFile} creato (${msgs2.length} msg, ${size2}MB)`)
}

console.log('\n🎉 Fatto!')
