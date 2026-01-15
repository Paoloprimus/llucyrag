/**
 * Parser per riferimenti temporali nelle query utente
 * Questo è un comportamento CORE di LLucy, attivo sempre.
 */

export interface TemporalRange {
  from: Date
  to: Date
  fuzzy: boolean // true se range approssimativo
  description: string // per debug/logging
}

/**
 * Parsa un messaggio e restituisce un range temporale se presente
 */
export function parseTemporalIntent(message: string): TemporalRange | null {
  const now = new Date()
  const text = message.toLowerCase()

  // "ieri"
  if (text.includes('ieri') && !text.includes('l\'altro ieri') && !text.includes('altroieri')) {
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    return {
      from: startOfDay(yesterday),
      to: endOfDay(yesterday),
      fuzzy: false,
      description: 'ieri'
    }
  }

  // "l'altro ieri" / "altroieri"
  if (text.includes('l\'altro ieri') || text.includes('altroieri')) {
    const dayBeforeYesterday = new Date(now)
    dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2)
    return {
      from: startOfDay(dayBeforeYesterday),
      to: endOfDay(dayBeforeYesterday),
      fuzzy: false,
      description: 'l\'altro ieri'
    }
  }

  // "oggi"
  if (text.includes('oggi') || text.includes('stamattina') || text.includes('stasera')) {
    return {
      from: startOfDay(now),
      to: endOfDay(now),
      fuzzy: false,
      description: 'oggi'
    }
  }

  // "questa settimana"
  if (text.includes('questa settimana')) {
    const startOfWeek = getStartOfWeek(now)
    return {
      from: startOfDay(startOfWeek),
      to: endOfDay(now),
      fuzzy: false,
      description: 'questa settimana'
    }
  }

  // "la settimana scorsa" / "settimana scorsa"
  if (text.includes('settimana scorsa') || text.includes('la scorsa settimana')) {
    const lastWeekEnd = getStartOfWeek(now)
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 1)
    const lastWeekStart = new Date(lastWeekEnd)
    lastWeekStart.setDate(lastWeekStart.getDate() - 6)
    return {
      from: startOfDay(lastWeekStart),
      to: endOfDay(lastWeekEnd),
      fuzzy: false,
      description: 'la settimana scorsa'
    }
  }

  // "questo mese"
  if (text.includes('questo mese')) {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    return {
      from: startOfDay(startOfMonth),
      to: endOfDay(now),
      fuzzy: false,
      description: 'questo mese'
    }
  }

  // "il mese scorso" / "mese scorso"
  if (text.includes('mese scorso') || text.includes('lo scorso mese')) {
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
    return {
      from: startOfDay(lastMonthStart),
      to: endOfDay(lastMonthEnd),
      fuzzy: false,
      description: 'il mese scorso'
    }
  }

  // "qualche giorno fa" / "alcuni giorni fa"
  if (text.includes('qualche giorno fa') || text.includes('alcuni giorni fa')) {
    const fiveDaysAgo = new Date(now)
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5)
    const twoDaysAgo = new Date(now)
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
    return {
      from: startOfDay(fiveDaysAgo),
      to: endOfDay(twoDaysAgo),
      fuzzy: true,
      description: 'qualche giorno fa'
    }
  }

  // "di recente" / "ultimamente" / "negli ultimi giorni"
  if (text.includes('di recente') || text.includes('ultimamente') || 
      text.includes('negli ultimi giorni') || text.includes('ultimi giorni')) {
    const weekAgo = new Date(now)
    weekAgo.setDate(weekAgo.getDate() - 7)
    return {
      from: startOfDay(weekAgo),
      to: endOfDay(now),
      fuzzy: true,
      description: 'di recente'
    }
  }

  // "tempo fa" / "un po' di tempo fa"
  if (text.includes('tempo fa') || text.includes('un po\' di tempo fa')) {
    const monthAgo = new Date(now)
    monthAgo.setDate(monthAgo.getDate() - 30)
    const twoWeeksAgo = new Date(now)
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
    return {
      from: startOfDay(monthAgo),
      to: endOfDay(twoWeeksAgo),
      fuzzy: true,
      description: 'tempo fa'
    }
  }

  // Giorni della settimana (es: "lunedì", "martedì scorso")
  const days = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato']
  for (let i = 0; i < days.length; i++) {
    if (text.includes(days[i])) {
      const targetDay = getLastOccurrenceOfDay(now, i)
      return {
        from: startOfDay(targetDay),
        to: endOfDay(targetDay),
        fuzzy: false,
        description: days[i]
      }
    }
  }

  // Mesi (es: "a gennaio", "in dicembre")
  const months = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
                  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
  for (let i = 0; i < months.length; i++) {
    if (text.includes(months[i])) {
      // Se il mese è futuro rispetto ad ora, usa l'anno scorso
      let year = now.getFullYear()
      if (i > now.getMonth()) {
        year -= 1
      }
      const monthStart = new Date(year, i, 1)
      const monthEnd = new Date(year, i + 1, 0)
      return {
        from: startOfDay(monthStart),
        to: endOfDay(monthEnd),
        fuzzy: false,
        description: `a ${months[i]}`
      }
    }
  }

  // Nessun riferimento temporale trovato
  return null
}

/**
 * Verifica se un messaggio contiene un riferimento temporale
 */
export function hasTemporalIntent(message: string): boolean {
  return parseTemporalIntent(message) !== null
}

// Helper functions

function startOfDay(date: Date): Date {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

function endOfDay(date: Date): Date {
  const result = new Date(date)
  result.setHours(23, 59, 59, 999)
  return result
}

function getStartOfWeek(date: Date): Date {
  const result = new Date(date)
  const day = result.getDay()
  // In Italia la settimana inizia di lunedì
  const diff = result.getDate() - day + (day === 0 ? -6 : 1)
  result.setDate(diff)
  return result
}

function getLastOccurrenceOfDay(from: Date, targetDay: number): Date {
  const result = new Date(from)
  const currentDay = result.getDay()
  
  // Calcola quanti giorni indietro andare
  let daysBack = currentDay - targetDay
  if (daysBack <= 0) {
    daysBack += 7 // Vai alla settimana precedente
  }
  
  result.setDate(result.getDate() - daysBack)
  return result
}

/**
 * Formatta una data in italiano
 */
export function formatDateIT(date: Date): string {
  const days = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato']
  const months = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
                  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
  
  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`
}

/**
 * Formatta l'ora in italiano
 */
export function formatTimeIT(date: Date): string {
  return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Restituisce il saluto appropriato per l'ora
 */
export function getGreeting(date: Date = new Date()): string {
  const hour = date.getHours()
  if (hour >= 5 && hour < 12) return 'Buongiorno'
  if (hour >= 12 && hour < 18) return 'Buon pomeriggio'
  if (hour >= 18 && hour < 22) return 'Buonasera'
  return 'Buonanotte'
}
