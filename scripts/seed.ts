// Fills the database (data/budgeting.db, or BUDGETING_DB) with ~4 months of realistic fake data.
// Refuses to touch a DB that has transactions. Usage: npm run seed   (to start over: delete the DB file first)
import { db, DB_FILE, insertTransaction } from '#lib/server/db.ts';
import { addDays, addMonths, today } from '#lib/dates.ts';

const { n } = db.prepare('SELECT COUNT(*) AS n FROM transactions').get() as { n: number };
if (n > 0) {
	console.error(`${DB_FILE} already has transactions. Delete it to reseed.`);
	process.exit(1);
}

// Deterministic randomness so the seeded data looks the same every time.
let state = 42;
function rand(): number {
	state = (state + 0x6d2b79f5) | 0;
	let t = Math.imul(state ^ (state >>> 15), 1 | state);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T>(items: T[]): T => items[Math.floor(rand() * items.length)];
const between = (min: number, max: number) => Math.round((min + rand() * (max - min)) * 100); // SAR -> cents

const TODAY = today();
const START = addMonths(TODAY.slice(0, 7) + '-01', -3);
const cat = (name: string) =>
	(db.prepare('SELECT id FROM categories WHERE name = ?').get(name) as { id: number }).id;

db.transaction(() => {
	// Accounts (Cash already exists from the migration)
	db.prepare('UPDATE accounts SET starting_balance = 250000 WHERE id = 1').run();
	const addAccount = db.prepare(
		'INSERT INTO accounts (name, currency, starting_balance, rate_to_default) VALUES (?, ?, ?, ?)'
	);
	const cash = 1;
	const bank = Number(addAccount.run('Everyday Bank', 'SAR', 1850000, 1).lastInsertRowid);
	const card = Number(addAccount.run('Everyday Card', 'SAR', 1400000, 1).lastInsertRowid);
	const wise = Number(addAccount.run('USD Account', 'USD', 120000, 3.75).lastInsertRowid);

	// Monthly budgets (SAR cents)
	const budgets: Record<string, number> = {
		Food: 250000, Transport: 90000, Bills: 550000, Subscriptions: 45000,
		Shopping: 60000, Health: 30000, Fun: 35000
	};
	const setBudget = db.prepare('UPDATE categories SET monthly_budget = ? WHERE name = ?');
	for (const [name, cents] of Object.entries(budgets)) setBudget.run(cents, name);

	const add = (date: string, category: string, cents: number, note: string, account = card) => {
		if (date < START || date > TODAY) return;
		const isIncome = category === 'Income';
		insertTransaction({
			account_id: account,
			category_id: cat(category),
			amount_cents: isIncome ? cents : -cents,
			date,
			note
		});
	};

	// Irregular freelance income: [months ago, day, SAR, note, account]
	const income: [number, number, number, string, number][] = [
		[3, 6, 14000, 'Client A: website build', bank],
		[3, 21, 3500, 'Client B: landing page', bank],
		[2, 2, 6000, 'Client C: monthly retainer', bank],
		[1, 2, 6000, 'Client C: monthly retainer', bank],
		[1, 11, 1450, 'Marketplace payout', wise], // USD
		[1, 27, 2200, 'Client D: store fixes', bank],
		[0, 2, 6000, 'Client C: monthly retainer', bank]
	];
	for (const [ago, day, amount, note, account] of income) {
		const date = addMonths(TODAY.slice(0, 7) + `-${String(day).padStart(2, '0')}`, -ago);
		add(date, 'Income', amount * 100, note, account);
	}

	// Fixed monthly bills
	for (let ago = 3; ago >= 0; ago--) {
		const month = addMonths(TODAY.slice(0, 7) + '-01', -ago).slice(0, 7);
		add(`${month}-01`, 'Bills', 400000, 'Rent', bank);
		add(`${month}-05`, 'Bills', 29900, 'Home internet', bank);
		add(`${month}-08`, 'Bills', between(180, 420), 'Electricity', bank);
		add(`${month}-12`, 'Bills', 11500, 'Mobile plan', card);
		add(`${month}-15`, 'Other', 6000, 'Haircut', cash);
	}

	// Subscriptions: [name, amount cents, cycle, renews in N days, category, account, active, auto_log, reviewed this month]
	const subs: [string, number, 'weekly' | 'monthly' | 'yearly', number, string, number, number, number, boolean][] = [
		['Video streaming', 5600, 'monthly', 4, 'Subscriptions', card, 1, 1, true],
		['Music streaming', 2199, 'monthly', 12, 'Subscriptions', card, 1, 1, true],
		['Cloud storage', 1199, 'monthly', 6, 'Subscriptions', card, 1, 1, false],
		['TV streaming', 2999, 'monthly', 19, 'Subscriptions', card, 0, 1, false],
		['Code assistant', 1000, 'monthly', 2, 'Subscriptions', wise, 1, 1, true],
		['Web hosting', 2000, 'monthly', 23, 'Subscriptions', wise, 1, 1, false],
		['Laundry service', 4500, 'weekly', 3, 'Other', card, 1, 0, true],
		['Gym membership', 249900, 'yearly', 140, 'Health', card, 1, 1, false],
		['Domain names', 1398, 'yearly', 61, 'Subscriptions', wise, 1, 1, true]
	];
	const addSub = db.prepare(
		`INSERT INTO subscriptions (name, amount_cents, cycle, next_renewal, category_id, account_id, active, auto_log, last_reviewed)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
	);
	for (const [name, cents, cycle, inDays, category, account, active, autoLog, reviewed] of subs) {
		const next = addDays(TODAY, inDays);
		const subId = Number(
			addSub.run(name, cents, cycle, next, cat(category), account, active, autoLog, reviewed ? TODAY : null)
				.lastInsertRowid
		);
		if (!active || !autoLog || cycle === 'yearly') continue;
		// Past renewals that would already have been auto-logged
		for (let k = 1; ; k++) {
			const date = cycle === 'weekly' ? addDays(next, -7 * k) : addMonths(next, -k);
			if (date < START) break;
			insertTransaction(
				{ account_id: account, category_id: cat(category), amount_cents: -cents, date, note: name },
				subId
			);
		}
	}

	// Day-to-day spending
	const food = ['Big Market', 'Corner Grocery', 'Neighborhood Market', 'Fried chicken', 'Delivery: shawarma', 'Delivery: burgers', 'Coffee shop', 'Cafe'];
	const transport = ['Ride share', 'Taxi', 'Fuel', 'Metro'];
	const shopping = ['Online store', 'Bookstore', 'Marketplace', 'Furniture store', 'Electronics store'];
	const fun = ['Cinema', 'Theme park', 'Game store', 'Sports court'];
	const health = ['Pharmacy', 'Clinic'];

	for (let date = START; date <= TODAY; date = addDays(date, 1)) {
		if (rand() < 0.7) {
			const place = pick(food);
			const big = place === 'Big Market' || place === 'Corner Grocery' || place === 'Neighborhood Market';
			add(date, 'Food', big ? between(120, 420) : between(18, 75), place, rand() < 0.2 ? cash : card);
		}
		if (rand() < 0.35) {
			const how = pick(transport);
			add(date, 'Transport', how === 'Fuel' ? between(90, 140) : between(4, 45), how);
		}
		if (rand() < 0.1) add(date, 'Shopping', between(60, 650), pick(shopping));
		if (rand() < 0.09) add(date, 'Fun', between(40, 220), pick(fun));
		if (rand() < 0.04) add(date, 'Health', between(25, 160), pick(health));
	}

})();

const counts = db
	.prepare(
		`SELECT (SELECT COUNT(*) FROM transactions) AS transactions,
		(SELECT COUNT(*) FROM subscriptions) AS subscriptions,
		(SELECT COUNT(*) FROM accounts) AS accounts`
	)
	.get();
console.log(`Seeded ${DB_FILE}:`, counts);
