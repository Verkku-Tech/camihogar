export interface LeadTimeCategoryThreshold {
  minStandardDays: number
  maxStandardDays: number
  warningExtraPercentage: number
  criticalExtraPercentage: number
}

export interface OtifThreshold {
  targetPercentage: number
  warningPercentage: number
  criticalPercentage: number
}

export interface FulfillmentThreshold {
  targetImmediatePercentage: number
  warningImmediatePercentage: number
  criticalImmediatePercentage: number
}

export interface OperationsMetricsSettings {
  id?: string
  defaultLeadTime: LeadTimeCategoryThreshold
  categoryLeadTimes: Record<string, LeadTimeCategoryThreshold>
  otif: OtifThreshold
  stageMaxStandardDays: Record<string, number>
  fulfillment: FulfillmentThreshold
}

export type MetricStatus = "green" | "blue" | "orange" | "red"

export interface MetricVisualResult {
  status: MetricStatus
  barClass: string
  textClass: string
  label: string
}

export function getLeadTimeStatus(days: number, threshold?: LeadTimeCategoryThreshold): MetricVisualResult {
  const t = threshold ?? {
    minStandardDays: 5,
    maxStandardDays: 7,
    warningExtraPercentage: 30,
    criticalExtraPercentage: 50
  }

  const warningLimit = t.maxStandardDays * (1 + t.warningExtraPercentage / 100)
  const criticalLimit = t.maxStandardDays * (1 + t.criticalExtraPercentage / 100)

  if (days < t.minStandardDays) {
    return {
      status: "green",
      barClass: "bg-emerald-500",
      textClass: "text-emerald-500 dark:text-emerald-400",
      label: "Por debajo del estándar"
    }
  }

  if (days <= t.maxStandardDays) {
    return {
      status: "blue",
      barClass: "bg-blue-500",
      textClass: "text-blue-500 dark:text-blue-400",
      label: "En rango estándar"
    }
  }

  if (days <= criticalLimit) {
    return {
      status: "orange",
      barClass: "bg-amber-500",
      textClass: "text-amber-500 dark:text-amber-400",
      label: "Por encima del estándar"
    }
  }

  return {
    status: "red",
    barClass: "bg-rose-500",
    textClass: "text-rose-500 dark:text-rose-400",
    label: "Muy por encima del estándar"
  }
}

export function getOtifStatus(rate: number, threshold?: OtifThreshold): MetricVisualResult {
  const t = threshold ?? {
    targetPercentage: 95,
    warningPercentage: 90,
    criticalPercentage: 80
  }

  if (rate >= t.targetPercentage) {
    return {
      status: "green",
      barClass: "bg-emerald-500",
      textClass: "text-emerald-500 dark:text-emerald-400",
      label: "Excelente"
    }
  }

  if (rate >= t.warningPercentage) {
    return {
      status: "blue",
      barClass: "bg-blue-500",
      textClass: "text-blue-500 dark:text-blue-400",
      label: "En rango estándar"
    }
  }

  if (rate >= t.criticalPercentage) {
    return {
      status: "orange",
      barClass: "bg-amber-500",
      textClass: "text-amber-500 dark:text-amber-400",
      label: "Bajo advertencia"
    }
  }

  return {
    status: "red",
    barClass: "bg-rose-500",
    textClass: "text-rose-500 dark:text-rose-400",
    label: "Crítico"
  }
}

export function getDwellTimeStatus(days: number, maxStandardDays: number = 5): MetricVisualResult {
  if (days < maxStandardDays * 0.7) {
    return {
      status: "green",
      barClass: "bg-emerald-500",
      textClass: "text-emerald-500 dark:text-emerald-400",
      label: "Óptimo"
    }
  }

  if (days <= maxStandardDays) {
    return {
      status: "blue",
      barClass: "bg-blue-500",
      textClass: "text-blue-500 dark:text-blue-400",
      label: "Estándar"
    }
  }

  if (days <= maxStandardDays * 1.5) {
    return {
      status: "orange",
      barClass: "bg-amber-500",
      textClass: "text-amber-500 dark:text-amber-400",
      label: "Cuello de botella"
    }
  }

  return {
    status: "red",
    barClass: "bg-rose-500",
    textClass: "text-rose-500 dark:text-rose-400",
    label: "Crítico"
  }
}
