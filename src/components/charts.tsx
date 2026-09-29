import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { num } from '../lib/format'

export const PALETTE = ['#5f7d68', '#c9a96e', '#7fa3c2', '#c98a7f', '#a4bca9', '#9a8bb0', '#d4b98c']
const axis = { fontSize: 11, fill: '#9aa09c' }
const grid = <CartesianGrid stroke="#eeebe4" strokeDasharray="3 4" vertical={false} />

const tooltipStyle = {
  contentStyle: { borderRadius: 12, border: '1px solid #e8e4dc', boxShadow: '0 12px 32px rgb(31 38 34 / .08)', fontSize: 12, padding: '8px 12px' },
  labelStyle: { color: '#6f7571', marginBottom: 4 },
  cursor: { stroke: '#c8d7cb', strokeWidth: 1, fill: 'rgba(227,235,228,.35)' },
}

type Series = { key: string; label: string; color?: string }
const fmt = (unit?: string) => (v: number) => `${num(v)}${unit ? ' ' + unit : ''}`

export function TrendChart({ data, x, series, height = 260, unit, kind = 'area' }: { data: object[]; x: string; series: Series[]; height?: number; unit?: string; kind?: 'area' | 'line' }) {
  const Chart = kind === 'area' ? AreaChart : LineChart
  return (
    <ResponsiveContainer width="100%" height={height}>
      <Chart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={s.color ?? PALETTE[i]} stopOpacity={0.22} />
              <stop offset="1" stopColor={s.color ?? PALETTE[i]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        {grid}
        <XAxis dataKey={x} tick={axis} tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} width={44} />
        <Tooltip {...tooltipStyle} formatter={(v: number, n) => [fmt(unit)(v), series.find((s) => s.key === n)?.label ?? n]} />
        {series.length > 1 && <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 12 }} formatter={(v) => series.find((s) => s.key === v)?.label} />}
        {series.map((s, i) =>
          kind === 'area' ? (
            <Area key={s.key} type="monotone" dataKey={s.key} stroke={s.color ?? PALETTE[i]} strokeWidth={2} fill={`url(#fill-${s.key})`} dot={false} activeDot={{ r: 4 }} />
          ) : (
            <Line key={s.key} type="monotone" dataKey={s.key} stroke={s.color ?? PALETTE[i]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          ),
        )}
      </Chart>
    </ResponsiveContainer>
  )
}

export function Bars({ data, x, series, height = 260, unit, horizontal, stacked }: { data: object[]; x: string; series: Series[]; height?: number; unit?: string; horizontal?: boolean; stacked?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 12, left: horizontal ? 8 : -8, bottom: 0 }} barCategoryGap={horizontal ? 6 : '22%'}>
        <CartesianGrid stroke="#eeebe4" strokeDasharray="3 4" vertical={!!horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" tick={axis} tickLine={false} axisLine={false} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
            <YAxis type="category" dataKey={x} tick={{ ...axis, fill: '#3c5143' }} tickLine={false} axisLine={false} width={150} />
          </>
        ) : (
          <>
            <XAxis dataKey={x} tick={axis} tickLine={false} axisLine={false} />
            <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} width={44} />
          </>
        )}
        <Tooltip {...tooltipStyle} formatter={(v: number, n) => [fmt(unit)(v), series.find((s) => s.key === n)?.label ?? n]} />
        {series.length > 1 && <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 12 }} formatter={(v) => series.find((s) => s.key === v)?.label} />}
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} stackId={stacked ? 'a' : undefined} fill={s.color ?? PALETTE[i]} radius={stacked && i < series.length - 1 ? 0 : horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]} maxBarSize={horizontal ? 18 : 34} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

export function Donut({ data, height = 220, unit, center }: { data: { name: string; value: number }[]; height?: number; unit?: string; center?: { value: string; label: string } }) {
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="64%" outerRadius="92%" paddingAngle={2} stroke="none">
            {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Pie>
          <Tooltip {...tooltipStyle} formatter={(v: number) => fmt(unit)(v)} />
        </PieChart>
      </ResponsiveContainer>
      {center && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className="text-center">
            <div className="text-xl font-semibold text-ink tabular-nums">{center.value}</div>
            <div className="text-[11px] text-muted">{center.label}</div>
          </div>
        </div>
      )}
    </div>
  )
}

export function Legendary({ items }: { items: { name: string; value: string }[] }) {
  return (
    <ul className="space-y-2 text-sm">
      {items.map((it, i) => (
        <li key={it.name} className="flex items-center gap-2">
          <span className="size-2.5 rounded-full shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
          <span className="text-muted truncate flex-1">{it.name}</span>
          <span className="font-medium tabular-nums">{it.value}</span>
        </li>
      ))}
    </ul>
  )
}

export function Spark({ data, color = '#5f7d68', height = 36 }: { data: number[]; color?: string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data.map((v, i) => ({ i, v }))} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`sp${color.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity={0.25} />
            <stop offset="1" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#sp${color.slice(1)})`} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
