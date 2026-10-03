-- Money is integer cents. Dates are 'YYYY-MM-DD' text.

CREATE TABLE accounts (
	id INTEGER PRIMARY KEY,
	name TEXT NOT NULL,
	currency TEXT NOT NULL DEFAULT 'SAR' CHECK (currency IN ('SAR', 'USD', 'EGP')),
	starting_balance INTEGER NOT NULL DEFAULT 0,
	-- Manual rate: 1 unit of this account's currency = X SAR. Not in the original spec schema,
	-- but needed to show totals in the default currency.
	rate_to_default REAL NOT NULL DEFAULT 1 CHECK (rate_to_default > 0)
);

CREATE TABLE categories (
	id INTEGER PRIMARY KEY,
	name TEXT NOT NULL UNIQUE COLLATE NOCASE,
	monthly_budget INTEGER CHECK (monthly_budget IS NULL OR monthly_budget >= 0),
	is_income INTEGER NOT NULL DEFAULT 0 CHECK (is_income IN (0, 1))
);

CREATE TABLE subscriptions (
	id INTEGER PRIMARY KEY,
	name TEXT NOT NULL,
	amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
	cycle TEXT NOT NULL CHECK (cycle IN ('weekly', 'monthly', 'yearly')),
	next_renewal TEXT NOT NULL,
	category_id INTEGER NOT NULL REFERENCES categories(id),
	account_id INTEGER NOT NULL REFERENCES accounts(id),
	active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
	auto_log INTEGER NOT NULL DEFAULT 1 CHECK (auto_log IN (0, 1)),
	last_reviewed TEXT
);

CREATE TABLE transactions (
	id INTEGER PRIMARY KEY,
	account_id INTEGER NOT NULL REFERENCES accounts(id),
	category_id INTEGER NOT NULL REFERENCES categories(id),
	amount_cents INTEGER NOT NULL,
	date TEXT NOT NULL,
	note TEXT NOT NULL DEFAULT '',
	subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL
);

CREATE INDEX transactions_date ON transactions(date);

INSERT INTO categories (name, is_income) VALUES
	('Food', 0), ('Transport', 0), ('Bills', 0), ('Subscriptions', 0), ('Shopping', 0),
	('Health', 0), ('Fun', 0), ('Other', 0), ('Income', 1);

INSERT INTO accounts (name, currency) VALUES ('Cash', 'SAR');
