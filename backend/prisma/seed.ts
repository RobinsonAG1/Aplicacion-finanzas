import { prisma } from '../src/db/prisma.js';
import { env } from '../src/config/env.js';
import { hashPassword } from '../src/utils/password.js';
import {
  AccountType,
  BudgetPeriod,
  CategoryType,
  PotTransactionType,
  ReminderChannel,
  ReminderStatus,
  TransactionType,
} from '../src/generated/prisma/client.js';

// ---------------------------------------------------------------------------
// Utilidades deterministas
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20261017);
const randInt = (min: number, max: number): number => Math.floor(rand() * (max - min + 1)) + min;
const pick = <T>(arr: readonly T[]): T => arr[randInt(0, arr.length - 1)] as T;
const roundCOP = (value: number): number => Math.round(value / 100) * 100;
const daysInMonth = (year: number, month: number): number => new Date(year, month + 1, 0).getDate();

// ---------------------------------------------------------------------------
// Definiciones de datos
// ---------------------------------------------------------------------------

const EXPENSE_CATEGORIES = [
  { name: 'Alimentación', color: '#16a34a' },
  { name: 'Restaurantes', color: '#f97316' },
  { name: 'Transporte', color: '#0ea5e9' },
  { name: 'Vivienda', color: '#8b5cf6' },
  { name: 'Servicios', color: '#eab308' },
  { name: 'Entretenimiento', color: '#ec4899' },
  { name: 'Salud', color: '#ef4444' },
  { name: 'Educación', color: '#6366f1' },
  { name: 'Compras', color: '#14b8a6' },
  { name: 'Suscripciones', color: '#a855f7' },
] as const;

const INCOME_CATEGORIES = [
  { name: 'Salario', color: '#22c55e' },
  { name: 'Freelance', color: '#10b981' },
  { name: 'Intereses', color: '#84cc16' },
] as const;

const ACCOUNTS = [
  { name: 'Bancolombia Ahorros', type: AccountType.SAVINGS, base: 3500000 },
  { name: 'Nequi', type: AccountType.CASH, base: 4000000 },
  { name: 'Davivienda Corriente', type: AccountType.CHECKING, base: 1500000 },
  { name: 'Efectivo', type: AccountType.CASH, base: 3000000 },
  { name: 'Nu Tarjeta de Crédito', type: AccountType.CREDIT, base: -1200000 },
  { name: 'Inversión CDT', type: AccountType.INVESTMENT, base: 8000000 },
] as const;

// Gastos fijos mensuales = facturas recurrentes (asi la deteccion por patrones las puede redescubrir)
const RECURRING = [
  { name: 'Arriendo', amount: 1400000, category: 'Vivienda', dueDay: 5, account: 'Bancolombia Ahorros' },
  { name: 'Claro Internet', amount: 120000, category: 'Servicios', dueDay: 15, account: 'Bancolombia Ahorros' },
  { name: 'Enel (energia)', amount: 180000, category: 'Servicios', dueDay: 18, account: 'Bancolombia Ahorros' },
  { name: 'EPM (agua)', amount: 90000, category: 'Servicios', dueDay: 20, account: 'Bancolombia Ahorros' },
  { name: 'Vanti (gas)', amount: 45000, category: 'Servicios', dueDay: 22, account: 'Nequi' },
  { name: 'Movistar Plan celular', amount: 65000, category: 'Servicios', dueDay: 25, account: 'Nequi' },
  { name: 'Netflix', amount: 44900, category: 'Suscripciones', dueDay: 10, account: 'Nequi' },
  { name: 'Spotify', amount: 24900, category: 'Suscripciones', dueDay: 12, account: 'Nequi' },
] as const;

interface VariableDef {
  name: string;
  merchants: readonly string[];
  min: number;
  max: number;
  minCount: number;
  maxCount: number;
}

const VARIABLE: readonly VariableDef[] = [
  {
    name: 'Alimentación',
    merchants: ['Éxito', 'D1', 'Ara', 'Olímpica', 'Carulla', 'Jumbo'],
    min: 40000,
    max: 180000,
    minCount: 4,
    maxCount: 7,
  },
  {
    name: 'Restaurantes',
    merchants: ["Rappi", "Domino's", 'KFC', 'Crepes & Waffles', 'El Corral', "McDonald's"],
    min: 25000,
    max: 90000,
    minCount: 3,
    maxCount: 6,
  },
  {
    name: 'Transporte',
    merchants: ['Uber', 'DiDi', 'TuLlave SITP', 'Terpel', 'Primax', 'Cabify'],
    min: 5000,
    max: 60000,
    minCount: 6,
    maxCount: 10,
  },
  {
    name: 'Entretenimiento',
    merchants: ['Cine Colombia', 'Steam', 'Panamericana', 'Ticket Express'],
    min: 20000,
    max: 120000,
    minCount: 1,
    maxCount: 3,
  },
  {
    name: 'Compras',
    merchants: ['Falabella', 'MercadoLibre', 'Alkosto', 'Homecenter'],
    min: 60000,
    max: 350000,
    minCount: 1,
    maxCount: 3,
  },
  {
    name: 'Salud',
    merchants: ['Cruz Verde', 'Farmatodo', 'Drogas La Rebaja', 'EPS Sura'],
    min: 20000,
    max: 150000,
    minCount: 0,
    maxCount: 2,
  },
  {
    name: 'Educación',
    merchants: ['Platzi', 'Udemy', 'Coursera', 'Sena'],
    min: 50000,
    max: 200000,
    minCount: 0,
    maxCount: 1,
  },
];

const VARIABLE_ACCOUNTS = ['Nequi', 'Davivienda Corriente', 'Efectivo', 'Bancolombia Ahorros'] as const;

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

const DEMO_EMAIL = 'demo@finanzas.test';
const DEMO_PASSWORD = 'Demo1234!';

async function main(): Promise<void> {
  if (env.isProduction && process.env.SEED_FORCE !== 'true') {
    throw new Error(
      'El seed borra todos los datos y no puede ejecutarse en produccion. ' +
        'Define SEED_FORCE=true para forzarlo conscientemente.',
    );
  }
  console.log('Limpiando datos previos...');
  await prisma.billReminder.deleteMany();
  await prisma.recurringBill.deleteMany();
  await prisma.potTransaction.deleteMany();
  await prisma.pot.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.category.deleteMany();
  await prisma.account.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  console.log('Creando usuario demo...');
  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      name: 'Usuario Demo',
      passwordHash: await hashPassword(DEMO_PASSWORD),
    },
  });

  console.log('Creando categorias...');
  const categoryByName = new Map<string, string>();
  for (const c of EXPENSE_CATEGORIES) {
    const created = await prisma.category.create({
      data: { userId: user.id, name: c.name, type: CategoryType.EXPENSE, color: c.color },
    });
    categoryByName.set(c.name, created.id);
  }
  for (const c of INCOME_CATEGORIES) {
    const created = await prisma.category.create({
      data: { userId: user.id, name: c.name, type: CategoryType.INCOME, color: c.color },
    });
    categoryByName.set(c.name, created.id);
  }
  const cat = (name: string): string => {
    const id = categoryByName.get(name);
    if (!id) throw new Error(`Categoria no encontrada: ${name}`);
    return id;
  };

  console.log('Creando cuentas...');
  const accountByName = new Map<string, string>();
  for (const a of ACCOUNTS) {
    const created = await prisma.account.create({
      data: { userId: user.id, name: a.name, type: a.type, balance: a.base, currency: 'COP' },
    });
    accountByName.set(a.name, created.id);
  }
  const acc = (name: string): string => {
    const id = accountByName.get(name);
    if (!id) throw new Error(`Cuenta no encontrada: ${name}`);
    return id;
  };

  interface TxRow {
    userId: string;
    accountId: string;
    categoryId: string | null;
    amount: number;
    type: TransactionType;
    description: string;
    merchant: string;
    date: Date;
  }
  const txRows: TxRow[] = [];

  const today = new Date();
  const monthsBack = 6;

  for (let offset = monthsBack - 1; offset >= 0; offset -= 1) {
    const ref = new Date(today.getFullYear(), today.getMonth() - offset, 1);
    const year = ref.getFullYear();
    const month = ref.getMonth();
    const lastDay = daysInMonth(year, month);
    const isCurrentMonth = offset === 0;
    const clampDay = (day: number): number =>
      isCurrentMonth ? Math.min(day, today.getDate()) : day;

    // ---- Ingresos ----
    const salaryAccounts = ['Bancolombia Ahorros', 'Davivienda Corriente'] as const;
    const payDays = [15, 30] as const;
    for (const [i, day] of payDays.entries()) {
      if (day > lastDay || (isCurrentMonth && day > today.getDate())) continue;
      txRows.push({
        userId: user.id,
        accountId: acc(salaryAccounts[i] ?? 'Bancolombia Ahorros'),
        categoryId: cat('Salario'),
        amount: 2000000,
        type: TransactionType.INCOME,
        description: 'Pago de nomina',
        merchant: 'Empleador S.A.S.',
        date: new Date(year, month, day),
      });
    }
    const interest = roundCOP(randInt(25000, 60000));
    txRows.push({
      userId: user.id,
      accountId: acc('Inversión CDT'),
      categoryId: cat('Intereses'),
      amount: interest,
      type: TransactionType.INCOME,
      description: 'Rendimiento CDT',
      merchant: 'Banco CDT',
      date: new Date(year, month, clampDay(28)),
    });
    if (rand() < 0.4) {
      const amount = roundCOP(randInt(400000, 1500000));
      txRows.push({
        userId: user.id,
        accountId: acc('Bancolombia Ahorros'),
        categoryId: cat('Freelance'),
        amount,
        type: TransactionType.INCOME,
        description: 'Proyecto freelance',
        merchant: 'Cliente Freelance',
        date: new Date(year, month, clampDay(randInt(3, 26))),
      });
    }

    // ---- Gastos fijos (coinciden con las facturas recurrentes) ----
    for (const bill of RECURRING) {
      if (isCurrentMonth && bill.dueDay > today.getDate()) continue;
      txRows.push({
        userId: user.id,
        accountId: acc(bill.account),
        categoryId: cat(bill.category),
        amount: bill.amount,
        type: TransactionType.EXPENSE,
        description: `Pago ${bill.name}`,
        merchant: bill.name.split(' ')[0] as string,
        date: new Date(year, month, bill.dueDay),
      });
    }

    // ---- Gastos variables ----
    for (const def of VARIABLE) {
      const count = randInt(def.minCount, def.maxCount);
      for (let i = 0; i < count; i += 1) {
        const day = randInt(1, lastDay);
        if (isCurrentMonth && day > today.getDate()) continue;
        const merchant = pick(def.merchants);
        txRows.push({
          userId: user.id,
          accountId: acc(pick(VARIABLE_ACCOUNTS)),
          categoryId: cat(def.name),
          amount: roundCOP(randInt(def.min, def.max)),
          type: TransactionType.EXPENSE,
          description: `Compra en ${merchant}`,
          merchant,
          date: new Date(year, month, day),
        });
      }
    }
  }

  console.log(`Insertando ${txRows.length} transacciones...`);
  await prisma.transaction.createMany({ data: txRows });

  // ---- Saldos = base + neto de transacciones ----
  const sums = await prisma.transaction.groupBy({
    by: ['accountId', 'type'],
    _sum: { amount: true },
  });
  const netByAccount = new Map<string, number>();
  for (const row of sums) {
    const sum = row._sum.amount?.toNumber() ?? 0;
    const delta = row.type === TransactionType.INCOME ? sum : -sum;
    netByAccount.set(row.accountId, (netByAccount.get(row.accountId) ?? 0) + delta);
  }
  for (const a of ACCOUNTS) {
    const id = acc(a.name);
    await prisma.account.update({
      where: { id },
      data: { balance: a.base + (netByAccount.get(id) ?? 0) },
    });
  }

  console.log('Creando presupuestos...');
  const budgetDefs = [
    { category: 'Alimentación', limit: 900000 },
    { category: 'Restaurantes', limit: 500000 },
    { category: 'Transporte', limit: 400000 },
    { category: 'Entretenimiento', limit: 300000 },
    { category: 'Compras', limit: 700000 },
    { category: 'Servicios', limit: 600000 },
  ];
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  await prisma.budget.createMany({
    data: budgetDefs.map((b) => ({
      userId: user.id,
      categoryId: cat(b.category),
      limitAmount: b.limit,
      period: BudgetPeriod.MONTHLY,
      startDate: monthStart,
      endDate: monthEnd,
    })),
  });

  console.log('Creando metas de ahorro (pots)...');
  const potDefs = [
    { name: 'Viaje a San Andrés', target: 2000000, deposits: [300000, 250000, 200000] },
    { name: 'Fondo de emergencia', target: 6000000, deposits: [800000, 600000, 400000] },
    { name: 'Computador nuevo', target: 4000000, deposits: [500000, 300000, 100000] },
  ];
  for (const def of potDefs) {
    const pot = await prisma.pot.create({
      data: { userId: user.id, name: def.name, targetAmount: def.target, currentAmount: 0 },
    });
    let current = 0;
    for (const deposit of def.deposits) {
      current += deposit;
      await prisma.potTransaction.create({
        data: { potId: pot.id, amount: deposit, type: PotTransactionType.DEPOSIT, note: 'Aporte' },
      });
    }
    await prisma.pot.update({ where: { id: pot.id }, data: { currentAmount: current } });
  }

  console.log('Creando facturas recurrentes y recordatorios...');
  for (const bill of RECURRING) {
    const created = await prisma.recurringBill.create({
      data: {
        userId: user.id,
        name: bill.name,
        amount: bill.amount,
        categoryId: cat(bill.category),
        dueDay: bill.dueDay,
        isActive: true,
      },
    });
    await prisma.billReminder.create({
      data: {
        billId: created.id,
        dueDate: new Date(today.getFullYear(), today.getMonth(), bill.dueDay),
        channel: ReminderChannel.LOG,
        status: ReminderStatus.PENDING,
      },
    });
  }

  console.log('Seed completado:', {
    user: DEMO_EMAIL,
    accounts: ACCOUNTS.length,
    categories: EXPENSE_CATEGORIES.length + INCOME_CATEGORIES.length,
    transactions: txRows.length,
    budgets: budgetDefs.length,
    pots: potDefs.length,
    bills: RECURRING.length,
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error('Seed fallo:', err);
    await prisma.$disconnect();
    process.exit(1);
  });
