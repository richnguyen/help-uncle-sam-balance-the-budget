// Data contract between the pipeline (scripts/build-data.mjs) and the app.
// All money values are in nominal U.S. dollars. Fiscal year (FY) N runs Oct 1 of N-1 to Sep 30 of N.

export interface Source {
  id: string;
  title: string;
  publisher: string;
  url: string;
  retrieved?: string; // ISO timestamp the pipeline fetched it
  note?: string;
}

export type CategoryId =
  | 'ss' | 'medicare' | 'health' | 'income' | 'veterans' | 'other' | 'defense' | 'interest';

export interface AnnualRow {
  fy: number;
  receipts: number;
  outlays: number;
  deficit: number; // positive = deficit (outlays > receipts)
}

export interface MonthRow {
  date: string; // month-end record date, e.g. 2026-09-30
  fy: number;
  fm: number; // fiscal month 1 (Oct) … 12 (Sep)
  receipts: number;
  outlays: number;
  deficit: number;
}

export interface FunctionRow {
  code: string; // OMB budget function code, e.g. "050"
  name: string; // as printed in the Monthly Treasury Statement
  amount: number;
  category: CategoryId | 'offset';
}

export type RevenueId = 'individual' | 'payroll' | 'corporate' | 'customs' | 'excise' | 'estate' | 'misc';

export interface ReceiptRow {
  id: RevenueId;
  name: string;
  amount: number;
}

export interface BudgetData {
  latestFY: number;
  /** Fiscal year in progress (partial), if the newest MTS is mid-year. */
  partialFY: { fy: number; through: string; receipts: number; outlays: number; deficit: number } | null;
  annual: AnnualRow[];
  monthly: MonthRow[];
  functionsByFY: Record<string, FunctionRow[]>;
  receiptsByFY: Record<string, ReceiptRow[]>;
  /** Receipts by source for each month (MTS Table 9, current-month column). */
  monthlyBySource: { date: string; fy: number; fm: number; values: Partial<Record<RevenueId, number>> }[];
  /** Social insurance receipts detail (MTS Table 4) for the latest FY. */
  payroll: { name: string; amount: number }[];
  /** Customs duties: gross collections, refunds, and net (MTS Table 4), by fiscal year. */
  customs: { fy: number; gross: number; refunds: number; net: number }[];
  population: { value: number; label: string; sourceId: string };
  households: { value: number; label: string; sourceId: string };
  mtsLatestDate: string;
}

export interface AccountNode {
  name: string;
  amount: number; // FY net outlays
  prior?: number; // prior FY net outlays (same path), when matched
  children?: AccountNode[];
}

export interface AccountsData {
  fy: number;
  root: AccountNode;
}

export interface DebtPoint {
  date: string;
  total: number;
  public: number;
  intragov: number;
}

export interface DebtData {
  latest: DebtPoint;
  series: DebtPoint[]; // month-end values
  byFY: { fy: number; total: number; change: number | null }[];
  interestByFY: { fy: number; gross: number }[];
  rates: { date: string; marketable: number; total: number }[];
  /** The statutory debt limit and the debt subject to it (Daily Treasury Statement, Table III-C). */
  limit?: { date: string; limit: number; subject: number };
}

export interface CBOYear {
  fy: number;
  actual: boolean;
  revenues: number;
  individual: number;
  payroll: number;
  corporate: number;
  otherRevenue: number;
  outlays: number;
  socialSecurity: number;
  medicare: number;
  medicaid: number;
  otherMandatory: number;
  mandatory: number;
  defense: number;
  nondefense: number;
  discretionary: number;
  netInterest: number;
  deficit: number; // positive = deficit
  debtPublic: number;
  gdp: number;
}

export interface CBOData {
  vintage: string; // e.g. "February 2026 baseline"
  history: CBOYear[];
  baseline: CBOYear[];
  /** OMB Table 1.2: receipts, outlays and the surplus (+) or deficit (−) as percentages of GDP, FY1930 on. */
  long: { fy: number; rev: number; out: number; def: number }[];
  historySourceId: string;
  baselineSourceId: string;
  /** Who made the projection ("CBO" or "OMB"), a short label, and what it assumes. */
  projBy: string;
  projShort: string;
  projAssumes: string;
  historyBy: string;
}

export type AwardType = 'contracts' | 'grants' | 'directPayments' | 'loans' | 'other';

export interface StateRow {
  abbr: string;
  fips: string;
  name: string;
  population: number;
  total: number;
  perCapita: number;
  byType: Record<AwardType, number>;
  agencies: { name: string; amount: number }[];
  programs: { code: string; name: string; amount: number }[];
  priorTotal?: number;
  /** Medicare awards recorded in this state (excluded from total; see State page). */
  medicare: number;
  totalWithMedicare: number;
}

export interface DistrictRow {
  code: string; // state FIPS + district, e.g. "0612"
  state: string; // abbr
  label: string; // e.g. "CA-12"
  population: number;
  total: number;
  perCapita: number;
  byType: Record<AwardType, number>;
  medicare: number;
  agencies?: { name: string; amount: number }[];
  programs?: { code: string; name: string; amount: number }[];
}

/** Districts are in their own file (districts.json), loaded by the state page when needed. */
export interface GeoData {
  fy: number;
  states: StateRow[];
  national: { total: number; population: number; perCapita: number; medicare: number };
  priorFY: number | null;
}

export interface TrustFundYear {
  year: number; // calendar year
  income: number;
  cost: number;
  reserves: number; // end of year
  projected: boolean;
}

export interface SSAData {
  report: string;
  released: string;
  depletion: {
    oasi: { year: number; quarter?: number; payablePct: number };
    di: { year: number; payablePct: number } | null;
    oasdi: { year: number; quarter?: number; payablePct: number };
    hi?: { year: number; quarter?: number; payablePct: number; report: string };
  };
  payableLongRun?: { year: number; pct: number };
  actuarialDeficit?: number; // % of taxable payroll
  fixes?: { label: string; value: string }[];
  /** Fiscal-year history from the Treasury (MTS Table 8). `year` is the fiscal year. */
  oasdi: TrustFundYear[];
  oasi: TrustFundYear[];
  di: TrustFundYear[];
  hi: TrustFundYear[];
  basis: 'fiscal';
  beneficiaries?: { total: number; asOf: string; sourceId: string };
  sourceIds: string[];
}

// ---------- curated, hand-verified datasets (data/curated) ----------

export interface Law {
  id: string;
  name: string;
  shortName: string;
  signed: string; // YYYY-MM-DD
  publicLaw: string;
  president: string;
  kind: 'tax' | 'emergency' | 'spending' | 'reduction' | 'mixed';
  /** CBO/JCT estimated change in deficits over the stated window, $ billions. + = larger deficits. */
  deficitEffect: number;
  window: string;
  includesInterest: boolean;
  summary: string;
  /** Plain-language explanation of what drove the estimate. */
  why?: string;
  source: { title: string; url: string };
}

export interface ProcessYear {
  fy: number;
  resolution: boolean; // a budget resolution was adopted by both chambers
  crs: number; // number of continuing resolutions enacted
  onTime: number; // regular appropriations acts (of 12) enacted by Oct 1
  shutdownDays: number; // total days of funding lapses affecting the year
  /** When a year had more than one lapse: each lapse, and whether it was government-wide. */
  lapses?: { days: number; broad: boolean; scope: string; start: string; end: string }[];
  final: string; // how full-year funding was finally provided
  notes?: string;
}

export interface ProcessData {
  years: ProcessYear[];
  lastAllOnTime?: { fy: number; note: string; source: { title: string; url: string } };
  current: { fy: number; status: string; asOf: string; source: { title: string; url: string } }[];
  sources: { title: string; url: string }[];
}

export interface ProgramInfo {
  category: CategoryId;
  plain: string;
  benefits: string;
  examples: string[];
  stats: { value: string; label: string; source: { title: string; url: string } }[];
}

export interface GlossaryTerm {
  id: string;
  term: string;
  def: string;
  /** Where the definition comes from (an id in the sources lists). */
  source?: string;
  /** Phrases that are linked to this term automatically wherever <Terms> wraps text. */
  aka?: string[];
}

export interface TaxParams {
  year: number;
  standardDeduction: Record<FilingStatus, number>;
  brackets: Record<FilingStatus, [number, number][]>; // [lower bound of taxable income, rate]
  ssRate: number;
  ssWageBase: number;
  medicareRate: number;
  addlMedicareRate: number;
  addlMedicareThreshold: Record<FilingStatus, number>;
  sources: { title: string; url: string }[];
}

export type FilingStatus = 'single' | 'married' | 'head';
