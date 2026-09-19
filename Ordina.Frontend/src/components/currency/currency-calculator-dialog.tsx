"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowDownUp, RefreshCw } from "lucide-react"

import { type ExchangeRate, type Currency, formatCurrency } from "@/lib/currency-utils"

interface CurrencyCalculatorDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function CurrencyCalculatorDialog({ open, onOpenChange }: CurrencyCalculatorDialogProps) {
    const [amount, setAmount] = useState<string>("1")
    const [fromCurrency, setFromCurrency] = useState<Currency>("USD")
    const [toCurrency, setToCurrency] = useState<Currency>("Bs")
    const [rates, setRates] = useState<{ USD?: ExchangeRate; EUR?: ExchangeRate }>({})
    const [result, setResult] = useState<number>(0)
    const [loading, setLoading] = useState(false)

    const loadRates = async () => {
        try {
            setLoading(true)
            const { ApiClient } = await import("@/lib/api-client")
            const client = new ApiClient()
            const activeRates = await client.getActiveExchangeRates()

            if (Array.isArray(activeRates)) {
                const usdRate = activeRates.find((r: any) => r.toCurrency === "USD")
                const eurRate = activeRates.find((r: any) => r.toCurrency === "EUR")

                setRates({
                    USD: usdRate,
                    EUR: eurRate,
                })
            }
        } catch (error) {
            console.error("Error loading rates:", error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (open) {
            loadRates()
        }
    }, [open])

    useEffect(() => {
        calculate()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [amount, fromCurrency, toCurrency, rates])

    const calculate = () => {
        const value = parseFloat(amount)
        if (isNaN(value)) {
            setResult(0)
            return
        }

        if (fromCurrency === toCurrency) {
            setResult(value)
            return
        }

        // Convertir de moneda origen a Bs
        let amountInBs = value
        if (fromCurrency !== "Bs") {
            const rate = rates[fromCurrency as "USD" | "EUR"]?.rate
            if (rate) {
                amountInBs = value * rate
            }
        }

        // Convertir de Bs a moneda destino
        if (toCurrency === "Bs") {
            setResult(amountInBs)
        } else {
            const rate = rates[toCurrency as "USD" | "EUR"]?.rate
            if (rate) {
                setResult(amountInBs / rate)
            } else {
                setResult(0)
            }
        }
    }

    const handleSwap = () => {
        setFromCurrency(toCurrency)
        setToCurrency(fromCurrency)
    }

    const getCurrentRate = () => {
        if (fromCurrency === "Bs" && toCurrency !== "Bs") {
            const rate = rates[toCurrency as "USD" | "EUR"]?.rate
            if (rate) return `1 ${toCurrency} = ${formatCurrency(rate, "Bs")}`
        } else if (fromCurrency !== "Bs" && toCurrency === "Bs") {
            const rate = rates[fromCurrency as "USD" | "EUR"]?.rate
            if (rate) return `1 ${fromCurrency} = ${formatCurrency(rate, "Bs")}`
        } else if (fromCurrency !== "Bs" && toCurrency !== "Bs") {
            // Cross rate (e.g. USD -> EUR)
            // Not strictly supported by direct rates but derived via Bs
            const fromRate = rates[fromCurrency as "USD" | "EUR"]?.rate
            const toRate = rates[toCurrency as "USD" | "EUR"]?.rate
            if (fromRate && toRate) {
                const crossRate = fromRate / toRate
                return `1 ${fromCurrency} = ${formatCurrency(crossRate, toCurrency)}`
            }
        }
        return null
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Calculadora de Divisas</DialogTitle>
                    <DialogDescription>
                        Convierte montos utilizando las tasas de cambio actuales del sistema.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">Cantidad</label>
                        <div className="flex gap-2">
                            <Input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="text-lg font-semibold"
                                placeholder="0.00"
                            />
                            <Select value={fromCurrency} onValueChange={(v) => setFromCurrency(v as Currency)}>
                                <SelectTrigger className="w-[100px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Bs">VES (Bs)</SelectItem>
                                    <SelectItem value="USD">USD ($)</SelectItem>
                                    <SelectItem value="EUR">EUR (€)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex justify-center -my-2">
                        <Button variant="ghost" size="icon" className="rounded-full" onClick={handleSwap}>
                            <ArrowDownUp className="h-5 w-5 text-muted-foreground" />
                        </Button>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">Se convierte a</label>
                        <div className="flex gap-2">
                            <div className="flex-1 px-3 py-2 bg-muted rounded-md text-lg font-bold flex items-center min-h-[40px]">
                                {formatCurrency(result, toCurrency)}
                            </div>
                            <Select value={toCurrency} onValueChange={(v) => setToCurrency(v as Currency)}>
                                <SelectTrigger className="w-[100px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Bs">VES (Bs)</SelectItem>
                                    <SelectItem value="USD">USD ($)</SelectItem>
                                    <SelectItem value="EUR">EUR (€)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {getCurrentRate() && (
                        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground bg-muted/30 p-2 rounded-md">
                            <RefreshCw className="h-3 w-3" />
                            <span>{getCurrentRate()}</span>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
