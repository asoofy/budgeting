export type Currency = 'SAR' | 'USD' | 'EGP';

export type Account = {
	id: number;
	name: string;
	currency: Currency;
	starting_balance: number;
	rate_to_default: number;
};

/** An account with its computed balance (in its own currency) and how much is attached to it. */
export type AccountWithBalance = Account & {
	balance: number;
	tx_count: number;
	sub_count: number;
};

export type Category = {
	id: number;
	name: string;
	monthly_budget: number | null;
	is_income: 0 | 1;
};

export type CategoryWithUsage = Category & {
	tx_count: number;
	sub_count: number;
	/** Name of the category its transactions move to if deleted; null if it's the last of its type. */
	fallback_name: string | null;
};

export type Transaction = {
	id: number;
	account_id: number;
	category_id: number;
	amount_cents: number;
	date: string;
	note: string;
	subscription_id: number | null;
};

export type TransactionInput = Omit<Transaction, 'id' | 'subscription_id'>;

/** A transaction joined with its category and account, as shown in lists. */
export type TransactionRow = Transaction & {
	category_name: string;
	is_income: 0 | 1;
	account_name: string;
	currency: Currency;
};

export type Subscription = {
	id: number;
	name: string;
	amount_cents: number;
	cycle: 'weekly' | 'monthly' | 'yearly';
	next_renewal: string;
	category_id: number;
	account_id: number;
	active: 0 | 1;
	auto_log: 0 | 1;
	last_reviewed: string | null;
};

export type SubscriptionInput = Omit<Subscription, 'id' | 'last_reviewed'>;

/** A subscription joined with its category and account, as shown in lists. */
export type SubscriptionRow = Subscription & {
	category_name: string;
	account_name: string;
	currency: Currency;
	rate_to_default: number;
};
