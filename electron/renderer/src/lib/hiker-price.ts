// Price of one billed HikerAPI request on the ClosRM account. Hiker's rate
// depends on the prepaid balance (hikerapi.com/plan, 2026-09-28): Start
// $0.02 (balance $20) · Standard $0.001 (balance $100) · Business $0.00069 ·
// Ultra $0.0006. ClosRM is on Start today — update this when the balance
// moves to a cheaper tier. Every paid action shows its cost with it.
export const HIKER_PRICE_USD = 0.02

export const formatDollars = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD', maximumFractionDigits: n < 1 ? 3 : 2 }).format(n)
