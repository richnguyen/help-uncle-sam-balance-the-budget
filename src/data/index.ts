// Typed access to the generated (pipeline) and curated (hand-verified) datasets.
import type { DtsData } from '../lib/dts';
import type {
  AccountsData, BudgetData, CBOData, DebtData, GeoData, GlossaryTerm, Law, ProcessData,
  ProgramInfo, Source, SSAData, TaxParams,
} from './types';
import budgetJson from './generated/budget.json';
import accountsJson from './generated/accounts.json';
import debtJson from './generated/debt.json';
import cboJson from './generated/cbo.json';
import geoJson from './generated/geo.json';
import ssaJson from './generated/ssa.json';
import sourcesJson from './generated/sources.json';
import dtsJson from './generated/dts.json';
import lawsJson from './curated/legislation.json';
import processJson from './curated/process.json';
import programsJson from './curated/programs.json';
import glossaryJson from './curated/glossary.json';
import taxJson from './curated/tax.json';
import curatedSourcesJson from './curated/sources.json';

export const budget = budgetJson as BudgetData;
export const accounts = accountsJson as AccountsData;
export const debt = debtJson as DebtData;
export const cbo = cboJson as CBOData;
export const geo = geoJson as GeoData;
export const ssa = ssaJson as SSAData;
/** The Daily Treasury Statement's running totals for this fiscal year (scripts/fetch-dts.mjs). */
export const dts = dtsJson as DtsData;
export const laws = lawsJson as Law[];
export const process = processJson as ProcessData;
export const programs = programsJson as Record<string, ProgramInfo>;
export const glossary = glossaryJson as GlossaryTerm[];
export const tax = taxJson as TaxParams;

export const SOURCES: Source[] = [...(sourcesJson as Source[]), ...(curatedSourcesJson as Source[])];
export const SOURCE_BY_ID: Record<string, Source> = Object.fromEntries(SOURCES.map((s) => [s.id, s]));
export const GLOSSARY_BY_ID: Record<string, GlossaryTerm> = Object.fromEntries(glossary.map((g) => [g.id, g]));

export const POP = budget.population.value;
export const HH = budget.households.value;

/** FY row from Treasury annual totals. */
export function fyTotals(fy: number) {
  return budget.annual.find((a) => a.fy === fy)!;
}
