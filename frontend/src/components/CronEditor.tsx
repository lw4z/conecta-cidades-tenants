import { useState, useCallback, useMemo } from 'react'

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const
const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const

const HOURS = Array.from({ length: 24 }, (_, i) => i)

interface CronState {
  days: boolean[]
  startHour: number
  endHour: number
}

function parseCron(expr: string): CronState {
  const defaults: CronState = { days: [false, true, true, true, true, true, false], startHour: 8, endHour: 17 }
  if (!expr) return defaults

  const parts = expr.trim().split(/\s+/)
  if (parts.length < 5) return defaults

  const [minute, hour, , , dow] = parts

  const days = Array(7).fill(false)
  if (dow === '*') {
    days.fill(true)
  } else {
    dow.split(',').forEach((d) => {
      const n = parseInt(d, 10)
      if (!isNaN(n) && n >= 0 && n <= 6) days[n] = true
    })
  }

  let startHour = 0
  let endHour = 23
  if (hour.includes('-')) {
    const [s, e] = hour.split('-').map(Number)
    startHour = s
    endHour = e
  } else if (hour !== '*') {
    startHour = parseInt(hour, 10)
    endHour = startHour
  }

  if (minute !== '0' && minute !== '00') {
    // ignore minute precision for the simple editor
  }

  return { days, startHour, endHour }
}

function buildCron(state: CronState): string {
  const { days, startHour, endHour } = state
  const activeDays = days
    .map((v, i) => (v ? i : -1))
    .filter((i) => i >= 0)
  const dow = activeDays.length === 7 ? '*' : activeDays.join(',')
  const hour = startHour === endHour ? `${startHour}` : `${startHour}-${endHour}`
  return `0 ${hour} * * ${dow}`
}

function describeCron(state: CronState): string {
  const { days, startHour, endHour } = state
  const activeDays = days
    .map((v, i) => (v ? i : -1))
    .filter((i) => i >= 0)

  if (activeDays.length === 0) return 'Nenhum dia selecionado'

  let dayText: string
  if (activeDays.length === 7) {
    dayText = 'Todos os dias'
  } else if (
    activeDays.length === 5 &&
    activeDays.includes(1) &&
    activeDays.includes(2) &&
    activeDays.includes(3) &&
    activeDays.includes(4) &&
    activeDays.includes(5) &&
    !activeDays.includes(0) &&
    !activeDays.includes(6)
  ) {
    dayText = 'Segunda a sexta'
  } else if (
    activeDays.length === 2 &&
    activeDays.includes(0) &&
    activeDays.includes(6)
  ) {
    dayText = 'Fins de semana'
  } else {
    const names = activeDays.map((d) => DAY_LABELS[d])
    dayText = names.join(', ')
  }

  if (startHour === endHour) {
    return `${dayText}, às ${String(startHour).padStart(2, '0')}h`
  }
  return `${dayText}, das ${String(startHour).padStart(2, '0')}h às ${String(endHour).padStart(2, '0')}h`
}

interface CronEditorProps {
  value: string
  onChange: (cron: string) => void
}

export default function CronEditor({ value, onChange }: CronEditorProps) {
  const [rawMode, setRawMode] = useState(false)
  const [rawInput, setRawInput] = useState(value)

  const state = useMemo(() => parseCron(value), [value])

  const handleDayToggle = useCallback(
    (dayIndex: number) => {
      const newDays = [...state.days]
      newDays[dayIndex] = !newDays[dayIndex]
      const newState = { ...state, days: newDays }
      onChange(buildCron(newState))
    },
    [state, onChange],
  )

  const handleHourChange = useCallback(
    (field: 'startHour' | 'endHour', val: number) => {
      const newState = { ...state, [field]: val }
      if (newState.startHour > newState.endHour) {
        if (field === 'startHour') newState.endHour = val
        else newState.startHour = val
      }
      onChange(buildCron(newState))
    },
    [state, onChange],
  )

  const toggleRaw = useCallback(() => {
    if (!rawMode) {
      setRawInput(value)
    } else {
      onChange(rawInput)
    }
    setRawMode(!rawMode)
  }, [rawMode, value, rawInput, onChange])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{describeCron(state)}</span>
        <button
          type="button"
          onClick={toggleRaw}
          className="text-xs text-blue-600 hover:text-blue-800"
        >
          {rawMode ? 'Editor visual' : 'Cron manual'}
        </button>
      </div>

      {rawMode ? (
        <input
          type="text"
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          onBlur={() => onChange(rawInput)}
          placeholder="0 8-17 * * 1-5"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {DAY_NAMES.map((day, i) => (
              <label key={day} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={state.days[i]}
                  onChange={() => handleDayToggle(i)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                {DAY_LABELS[i]}
              </label>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600">Das</label>
            <select
              value={state.startHour}
              onChange={(e) => handleHourChange('startHour', Number(e.target.value))}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}h
                </option>
              ))}
            </select>
            <label className="text-sm text-gray-600">até</label>
            <select
              value={state.endHour}
              onChange={(e) => handleHourChange('endHour', Number(e.target.value))}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}h
                </option>
              ))}
            </select>
          </div>
        </>
      )}
      <div className="text-xs text-gray-400">
        Expressão: <code className="font-mono">{value || '—'}</code>
      </div>
    </div>
  )
}
