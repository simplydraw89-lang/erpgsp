export const workspaceTimeZone = "Asia/Bangkok"

export function getPersonalGreeting(name: string, now = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: workspaceTimeZone,
    }).format(now),
  )
  const greeting =
    hour < 11
      ? "Selamat pagi"
      : hour < 15
        ? "Selamat siang"
        : hour < 18
          ? "Selamat sore"
          : "Selamat malam"
  const firstName = name.trim().split(/\s+/)[0] || "Pengguna"
  return {
    greeting,
    firstName,
    date: new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: workspaceTimeZone,
    }).format(now),
  }
}

export function getDisplayName(user: {
  email?: string
  user_metadata?: Record<string, unknown>
}) {
  const full = user.user_metadata?.full_name ?? user.user_metadata?.name
  return typeof full === "string" && full.trim()
    ? full.trim()
    : user.email?.split("@")[0] || "Pengguna"
}

export function calendarDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: workspaceTimeZone,
  }).formatToParts(now)
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? ""
  return `${get("year")}-${get("month")}-${get("day")}`
}

export function daysUntil(due: string, today: string) {
  return Math.round(
    (new Date(`${due}T00:00:00+07:00`).getTime() -
      new Date(`${today}T00:00:00+07:00`).getTime()) /
      86400000,
  )
}

export function calendarDay(value:unknown):string|null {
  if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(value))return null
  const day=value.slice(0,10)
  const parsed=new Date(`${day}T12:00:00+07:00`)
  return Number.isFinite(parsed.getTime())&&calendarDate(parsed)===day?day:null
}
