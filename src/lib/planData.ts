import optionsJson from '../data/curated/options.json';
import type { Econ, OptionsData, PolicyOption } from './plan';

export const OPTIONS_DATA = optionsJson as OptionsData;

// Economic classification of each CBO option: which of CBO's multiplier categories it falls in,
// its long-run growth effect, and which protections it would cross. Rules below match on the
// option's name; OVERRIDES pin specific options by id.
const RULES: { test: RegExp; econ: Econ }[] = [
  { test: /carbon|greenhouse|emission/i, econ: { cls: 'taxBroad', growth: 1, tags: [], why: 'Prices pollution, so it raises money while discouraging a harmful activity; costs are passed to consumers.' } },
  { test: /value-added|\bVAT\b/i, econ: { cls: 'taxBroad', growth: 1, tags: [], why: 'Taxes consumption rather than saving and investment, which economists find less harmful to growth, but it falls on everyone.' } },
  { test: /alcohol/i, econ: { cls: 'taxBroad', growth: 1, tags: [], why: 'Discourages excessive drinking and its health costs; paid by consumers.' } },
  { test: /motor fuel|gasoline|gas tax|fuel tax/i, econ: { cls: 'taxBroad', growth: 1, tags: [], why: 'Pays for roads and reflects driving’s costs such as pollution and congestion; paid by drivers.' } },
  { test: /health insurance|exclusion/i, econ: { cls: 'taxBroad', growth: 1, tags: [], why: 'Trims a tax break that encourages costlier health plans; mostly affects workers with generous employer coverage.' } },
  { test: /itemized|state and local|mortgage interest|deduction/i, econ: { cls: 'taxHigh', growth: 1, tags: [], why: 'Broadens the tax base by trimming deductions used mostly by higher-income households, without raising tax rates.' } },
  { test: /carried interest/i, econ: { cls: 'taxHigh', growth: 0, tags: [], why: 'Affects investment-fund managers; small effect on the wider economy.' } },
  { test: /corporate/i, econ: { cls: 'corporate', growth: -1, tags: [], why: 'Little short-run effect on spending, but a higher rate can reduce business investment over time.' } },
  { test: /maximum taxable|taxable earnings|taxable maximum/i, econ: { cls: 'taxHigh', growth: 0, tags: [], why: 'Applies only to earnings above today’s cap, so it falls on the highest earners and their employers.' } },
  { test: /payroll tax rate/i, econ: { cls: 'taxBroad', growth: 0, tags: [], why: 'Falls on nearly every worker and employer.' } },
  { test: /individual income tax rates|income tax rates/i, econ: { cls: 'taxBroad', growth: -1, tags: [], why: 'Raises tax rates for nearly every taxpayer, which reduces take-home pay and incentives to work and save.' } },
  { test: /medicare advantage/i, econ: { cls: 'transfersPersons', growth: 1, tags: [], why: 'Trims payments to private insurers that exceed the cost of traditional Medicare; plans may offer fewer extra benefits.' } },
  { test: /site-neutral|outpatient/i, econ: { cls: 'transfersPersons', growth: 1, tags: [], why: 'Pays the same for the same service wherever it is delivered, removing an incentive for higher-cost hospital billing.' } },
  { test: /part b premium|premiums/i, econ: { cls: 'transfersPersons', growth: 0, tags: ['retirees', 'beneficiaries'], why: 'Raises costs for current and future Medicare enrollees.' } },
  { test: /age of eligibility for medicare|medicare.*67/i, econ: { cls: 'transfersPersons', growth: 0, tags: ['beneficiaries'], why: 'Shifts costs for 65- and 66-year-olds to employers, Medicaid, or the marketplaces; current enrollees keep coverage.' } },
  { test: /medicaid/i, econ: { cls: 'transfersStates', growth: 0, tags: ['lowIncome'], why: 'Shifts costs to states, which would likely cut coverage or payments for low-income people.' } },
  { test: /retirement age/i, econ: { cls: 'transfersPersons', growth: 1, tags: ['beneficiaries'], why: 'Phases in for younger workers only and encourages longer careers; current retirees are not affected.' } },
  { test: /chained|alternative measure of inflation|cost-of-living/i, econ: { cls: 'transfersPersons', growth: 0, tags: ['retirees', 'beneficiaries'], why: 'Slows yearly benefit increases for current and future beneficiaries, with the effect growing over time.' } },
  { test: /high earners|progressive price|benefits for|benefit formula|social security benefits/i, econ: { cls: 'transfersPersons', growth: 0, tags: ['beneficiaries'], why: 'Reduces future benefits mostly for higher earners; current retirees are not affected.' } },
  { test: /defense|military/i, econ: { cls: 'purchases', growth: 0, tags: [], why: 'Government purchases have the largest short-run effect per dollar, so cuts should be phased in.' } },
  { test: /nondefense|non-defense/i, econ: { cls: 'purchases', growth: -1, tags: ['investment', 'lowIncome'], why: 'Would squeeze research, infrastructure, education, and some aid to low-income families, which support long-run growth.' } },
  { test: /crop insurance|farm|agricultur/i, econ: { cls: 'transfersPersons', growth: 1, tags: [], why: 'Trims subsidies that mainly benefit larger farms and encourage riskier planting.' } },
];

const FALLBACK: Record<PolicyOption['side'], Econ> = {
  revenue: { cls: 'taxBroad', growth: 0, tags: [], why: 'A broad tax change.' },
  spending: { cls: 'transfersPersons', growth: 0, tags: [], why: 'A spending change.' },
};

// Explicit classification of every option in the current data (rules above are only a fallback).
const OVERRIDES: Record<string, Partial<Econ>> = {
  'income-tax-rates-1pt': { cls: 'taxBroad', growth: -1, tags: [], why: 'Raises tax rates for nearly every taxpayer, which reduces take-home pay and incentives to work and save.' },
  'corp-rate-1pt': { cls: 'corporate', growth: -1, tags: [], why: 'Little short-run effect on spending, but a higher rate can reduce business investment over time.' },
  'ss-tax-earnings-over-250k': { cls: 'taxHigh', growth: -1, tags: [], why: 'Falls on the highest earners, who spend a smaller share of each dollar, but raises their tax rate on extra earnings by 12.4 points, which can discourage some work.' },
  'carbon-tax-25': { cls: 'taxBroad', growth: 1, tags: ['lowIncome'], why: 'Prices pollution, raising money while discouraging a harmful activity. Without rebates it falls hardest on lower-income households.' },
  'vat-5pct': { cls: 'taxBroad', growth: 1, tags: ['lowIncome'], why: 'Taxes consumption rather than saving and investment, which economists find less harmful to growth, but it takes a larger share of lower-income budgets.' },
  'cap-health-exclusion': { cls: 'taxBroad', growth: 1, tags: [], why: 'Trims a tax break that encourages costlier health plans; mostly affects workers with generous employer coverage.' },
  'limit-itemized-15pct': { cls: 'taxHigh', growth: 1, tags: [], why: 'Broadens the tax base by trimming deductions used mostly by higher-income households, without raising tax rates.' },
  'gas-tax-15c': { cls: 'taxBroad', growth: 1, tags: [], why: 'Pays for roads and reflects driving’s costs such as pollution and congestion; paid by drivers and shippers.' },
  'alcohol-tax': { cls: 'taxBroad', growth: 1, tags: [], why: 'Discourages excessive drinking and its health costs; paid by consumers.' },
  'carried-interest': { cls: 'taxHigh', growth: 0, tags: [], why: 'Affects investment-fund managers; little effect on the wider economy.' },
  'medicare-advantage-benchmarks': { cls: 'transfersPersons', growth: 1, tags: [], why: 'Trims payments to private insurers that exceed what traditional Medicare spends; plans may offer fewer extra benefits.' },
  'site-neutral-hospital-outpatient': { cls: 'transfersPersons', growth: 1, tags: [], why: 'Pays the same for the same service wherever it is delivered, removing an incentive for higher-cost hospital billing.' },
  'part-b-premium-35pct': { cls: 'transfersPersons', growth: 0, tags: ['retirees', 'beneficiaries'], why: 'Raises costs for current and future Medicare enrollees.' },
  'medicaid-per-enrollee-caps': { cls: 'transfersStates', growth: 0, tags: ['lowIncome'], why: 'Shifts costs to states, which would likely cut coverage or payments for low-income people.' },
  'raise-full-retirement-age-70': { cls: 'transfersPersons', growth: 1, tags: ['beneficiaries'], why: 'Phases in slowly for people born in 1964 or later and encourages longer careers; people already collecting are not affected.' },
  'chained-cpi': { cls: 'transfersPersons', growth: 0, tags: ['retirees', 'beneficiaries'], why: 'Slows yearly benefit increases for current and future beneficiaries, with the effect growing over time.' },
  'ss-benefits-high-earners': { cls: 'transfersPersons', growth: 0, tags: ['beneficiaries'], why: 'Reduces future benefits for higher earners only; current retirees are not affected.' },
  'cut-defense-budget': { cls: 'purchases', growth: 0, tags: [], why: 'Government purchases have the largest short-run effect per dollar, so cuts are best phased in.' },
  'cut-transport-education-grants': { cls: 'stateInfra', growth: -1, tags: ['investment'], why: 'Cuts money for roads, transit, and schools, which support long-run growth.' },
  'crop-insurance-subsidies': { cls: 'transfersPersons', growth: 1, tags: [], why: 'Trims subsidies that mainly benefit larger farms and encourage riskier planting.' },
  // Two-way cards: these add to deficits (negative savings). The class says how much the extra money moves the economy at first.
  'extend-aca-credits': { cls: 'transfersPersons', growth: 0, tags: [], why: 'Puts more money in households’ hands through lower premiums, which adds to spending in the short run; it adds to borrowing unless it is paid for.' },
  'extend-obbba-temp-tax': { cls: 'taxBroad', growth: 0, tags: [], why: 'Leaves more money with workers and retirees who claim the breaks, which adds to spending in the short run; it adds to borrowing unless it is paid for.' },
};

export function econFor(o: PolicyOption): Econ {
  const rule = RULES.find((r) => r.test.test(o.name + ' ' + o.cboTitle));
  const base = rule?.econ ?? FALLBACK[o.side];
  return { ...base, ...(OVERRIDES[o.id] ?? {}) };
}

export function withEcon() {
  return OPTIONS_DATA.options.map((o) => ({ ...o, econ: econFor(o) }));
}

export interface Preset { id: string; name: string; blurb: string; optimizer?: boolean; ids?: string[] }

/** Keep only ids present in the data (the fixed plans survive data updates). */
const ids = (...want: string[]) => want.filter((id) => OPTIONS_DATA.options.some((o) => o.id === id));

export const PRESETS: Preset[] = [
  {
    id: 'economists',
    name: 'The economists’ plan',
    blurb: 'Built automatically from your goal and ground rules: phased in, balanced between revenue and spending, and choosing the options that do the least harm to the economy per dollar saved.',
    optimizer: true,
  },
  {
    id: 'revenue',
    name: 'Ask more of high earners and corporations',
    blurb: 'Closes the gap with revenue: Social Security taxes on earnings above $250,000, limits on itemized deductions, a higher corporate rate, taxing carried interest, and a tax on carbon pollution. Leaves benefits untouched.',
    ids: ids('corp-rate-1pt', 'ss-tax-earnings-over-250k', 'limit-itemized-15pct', 'carried-interest', 'carbon-tax-25'),
  },
  {
    id: 'spending',
    name: 'Slow the growth of spending',
    blurb: 'Relies on spending changes: paying Medicare insurers and hospitals more efficiently, higher Part B premiums, slower cost-of-living raises, gradual Social Security changes for younger workers, and cuts to defense, grants, and farm subsidies.',
    ids: ids('medicare-advantage-benchmarks', 'site-neutral-hospital-outpatient', 'part-b-premium-35pct', 'chained-cpi', 'raise-full-retirement-age-70', 'ss-benefits-high-earners', 'cut-defense-budget', 'cut-transport-education-grants', 'crop-insurance-subsidies'),
  },
  {
    id: 'protect',
    name: 'Protect Social Security and Medicare benefits',
    blurb: 'Keeps every Social Security and Medicare benefit as scheduled. Combines revenue from high earners, corporations, and tax breaks with savings from Medicare insurers and hospitals, defense, and farm subsidies.',
    ids: ids('ss-tax-earnings-over-250k', 'corp-rate-1pt', 'limit-itemized-15pct', 'cap-health-exclusion', 'medicare-advantage-benchmarks', 'site-neutral-hospital-outpatient', 'cut-defense-budget', 'crop-insurance-subsidies'),
  },
];
