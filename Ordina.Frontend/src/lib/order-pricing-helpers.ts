import type { Category, Product, AttributeValue, CalculateUnitPriceOptions, SaleTypeCommissionRule } from '@/types'
import type { Currency } from '@/lib/currency-utils'
import { backendIdToNumber } from '@/lib/storage'

export function resolveProductFromAttributeValue(
  val: AttributeValue,
  productsMap: Map<number, Product>,
  allProducts: Product[]
): Product | undefined {
  const rawBackend = val.productBackendId?.trim()
  if (rawBackend) {
    if (/^[a-f0-9]{24}$/i.test(rawBackend)) {
      const numeric = backendIdToNumber(rawBackend)
      const byNum = productsMap.get(numeric)
      if (byNum) return byNum
    }
    const byBackend = allProducts.find(p => p.backendId === rawBackend)
    if (byBackend) return byBackend
  }
  if (val.productId != null) {
    const byId = productsMap.get(val.productId)
    if (byId) return byId
  }
  const label = val.label?.trim().toLowerCase()
  if (label) {
    const matches = allProducts.filter(p => p.name.trim().toLowerCase() === label)
    if (matches.length === 1) return matches[0]
  }
  return undefined
}

const convertAdjustmentToTarget = (
  adjustment: number,
  fromCurrency: string | undefined,
  targetCurrency: Currency,
  exchangeRates?: { USD?: { rate: number }; EUR?: { rate: number } }
): number => {
  const from = (fromCurrency || 'Bs') as Currency
  if (from === targetCurrency) return adjustment

  let amountInBs = adjustment
  if (from !== 'Bs') {
    const fromRate = from === 'USD' ? exchangeRates?.USD?.rate : exchangeRates?.EUR?.rate
    if (!fromRate || fromRate <= 0) return adjustment
    amountInBs = adjustment * fromRate
  }

  if (targetCurrency === 'Bs') return amountInBs

  const toRate = targetCurrency === 'USD' ? exchangeRates?.USD?.rate : exchangeRates?.EUR?.rate
  if (!toRate || toRate <= 0) return adjustment
  return amountInBs / toRate
}

export const calculateProductUnitPriceWithAttributes = (
  basePrice: number,
  productAttributes: Record<string, string | number | string[]> | undefined,
  category: Category | undefined,
  exchangeRates?: { USD?: any; EUR?: any },
  allProducts: Product[] = [],
  categories: Category[] = [],
  options?: CalculateUnitPriceOptions
): number => {
  const targetCurrency: Currency = options?.targetCurrency ?? 'Bs'
  const basePriceCurrency: Currency = options?.basePriceCurrency ?? 'Bs'

  let normalizedBase = basePrice
  if (basePriceCurrency !== targetCurrency) {
    normalizedBase = convertAdjustmentToTarget(
      basePrice,
      basePriceCurrency,
      targetCurrency,
      exchangeRates
    )
  }

  if (!productAttributes || !category || !category.attributes) {
    return normalizedBase
  }

  let totalAdjustment = 0

  const convertAdjustment = (adjustment: number, currency?: string): number =>
    convertAdjustmentToTarget(adjustment, currency, targetCurrency, exchangeRates)

  Object.entries(productAttributes).forEach(([attrKey, selectedValue]) => {
    const categoryAttribute = category.attributes.find(
      attr => attr.id.toString() === attrKey || attr.title === attrKey
    )

    if (!categoryAttribute || !categoryAttribute.values) {
      return
    }

    if (categoryAttribute.valueType === 'Product') {
      const processProductPrice = (productId: any) => {
        const productIdNum = typeof productId === 'number' ? productId : parseInt(productId)

        const foundProduct = allProducts.find(
          p => p.id === productIdNum || p.backendId === productId.toString()
        )
        if (foundProduct) {
          const pCurrency = (foundProduct.priceCurrency || 'Bs') as Currency
          const pPrice = convertAdjustmentToTarget(
            foundProduct.price,
            pCurrency,
            targetCurrency,
            exchangeRates
          )
          totalAdjustment += pPrice

          const subAttrKey = `${attrKey}_${foundProduct.id}`
          const subAttrs = (productAttributes as Record<string, unknown>)[subAttrKey] as
            | Record<string, string | number | string[]>
            | undefined
          if (subAttrs) {
            const subCategory = categories.find(c => c.name === foundProduct.category)
            if (subCategory) {
              totalAdjustment += calculateProductUnitPriceWithAttributes(
                0,
                subAttrs,
                subCategory,
                exchangeRates,
                allProducts,
                categories,
                { targetCurrency, basePriceCurrency: targetCurrency }
              )
            }
          }
        }
      }

      if (Array.isArray(selectedValue)) {
        selectedValue.forEach(processProductPrice)
      } else if (selectedValue) {
        processProductPrice(selectedValue)
      }
      return
    }

    if (Array.isArray(selectedValue)) {
      selectedValue.forEach(valStr => {
        const attributeValue = categoryAttribute.values.find(val => {
          if (typeof val === 'string') {
            return val === valStr
          }
          return val.id === valStr || val.label === valStr
        })

        if (
          attributeValue &&
          typeof attributeValue === 'object' &&
          'priceAdjustment' in attributeValue
        ) {
          const adjustment = attributeValue.priceAdjustment || 0
          const currency = attributeValue.priceAdjustmentCurrency || 'Bs'
          totalAdjustment += convertAdjustment(adjustment, currency)
        }
      })
    } else {
      const selectedValueStr = selectedValue.toString()
      const attributeValue = categoryAttribute.values.find(val => {
        if (typeof val === 'string') {
          return val === selectedValueStr
        }
        return val.id === selectedValueStr || val.label === selectedValueStr
      })

      if (
        attributeValue &&
        typeof attributeValue === 'object' &&
        'priceAdjustment' in attributeValue
      ) {
        const adjustment = attributeValue.priceAdjustment || 0
        const currency = attributeValue.priceAdjustmentCurrency || 'Bs'
        totalAdjustment += convertAdjustment(adjustment, currency)
      }
    }
  })

  return normalizedBase + totalAdjustment
}

export const FAMILY_COMMISSION_USD_TIERS = [2.5, 5, 7.5] as const

export function pickSaleTypeCommissionRule(
  rules: SaleTypeCommissionRule[],
  saleType: string,
  commissionUsdPerUnit: number
): SaleTypeCommissionRule | undefined {
  const st = ((saleType || '').trim() || 'entrega').toLowerCase()
  const eps = 0.0001
  const matchedTier = FAMILY_COMMISSION_USD_TIERS.find(
    t => Math.abs(commissionUsdPerUnit - t) < eps
  )
  const tier = matchedTier ?? 2.5
  const byType = rules.filter(r => r.saleType.toLowerCase() === st)
  if (byType.length === 0) return undefined
  const exact = byType.find(
    r => Math.abs((r.familyCommissionUsdPerUnit ?? 0) - tier) < eps
  )
  if (exact) return exact
  return [...byType].sort(
    (a, b) => (a.familyCommissionUsdPerUnit ?? 0) - (b.familyCommissionUsdPerUnit ?? 0)
  )[0]
}
