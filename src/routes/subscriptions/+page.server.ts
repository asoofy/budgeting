import { fail } from '@sveltejs/kit';
import * as db from '#lib/server/db.ts';
import { isValidDate, today } from '#lib/dates.ts';
import { parseAmount } from '#lib/money.ts';
import { CYCLES, renewsSoon, rollForward, totals, type Cycle } from '#lib/renewals.ts';
import type { SubscriptionInput } from '#lib/types.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100);
	const subscriptions = db.listSubscriptions(q);
	const now = today();
	const active = subscriptions.filter((s) => s.active);

	return {
		q,
		subscriptions,
		// Totals cover active subscriptions only. They respect the search box, which is
		// a feature: search "Subscriptions" to see what that category costs.
		totals: totals(active.map((s) => ({ ...s, rate: s.rate_to_default }))),
		soon: active.filter((s) => renewsSoon(s.next_renewal, now)),
		categories: db.listCategories().filter((c) => !c.is_income),
		accounts: db.listAccounts(),
		today: now,
		defaultAccountId: db.lastUsedAccountId() ?? db.listAccounts()[0]?.id
	};
};

function parseForm(form: FormData): { sub: SubscriptionInput } | { error: string } {
	const name = String(form.get('name') ?? '').trim().replace(/\s+/g, ' ');
	if (!name) return { error: 'Enter a name.' };
	if (name.length > 60) return { error: 'Keep the name under 60 characters.' };

	const amount = parseAmount(String(form.get('amount') ?? ''));
	if (amount === null) return { error: 'Enter an amount like 56 or 21.99.' };

	const cycle = String(form.get('cycle'));
	if (!CYCLES.includes(cycle as Cycle)) return { error: 'Pick weekly, monthly or yearly.' };

	const date = String(form.get('next_renewal') ?? '');
	if (!isValidDate(date)) return { error: 'Enter a valid renewal date.' };

	const category = db.getCategory(Number(form.get('category_id')));
	if (!category || category.is_income) return { error: 'Pick a category.' };

	const account = db.getAccount(Number(form.get('account_id')));
	if (!account) return { error: 'Pick an account.' };

	return {
		sub: {
			name,
			amount_cents: amount,
			cycle: cycle as Cycle,
			// A date in the past means "it already renewed": skip ahead to the next one
			// without logging anything, so nothing gets double-counted.
			next_renewal: rollForward(date, cycle as Cycle, today()),
			category_id: category.id,
			account_id: account.id,
			active: form.get('active') === 'on' ? 1 : 0,
			auto_log: form.get('auto_log') === 'on' ? 1 : 0
		}
	};
}

function parseId(form: FormData): number | null {
	const id = Number(form.get('id'));
	return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export const actions: Actions = {
	save: async ({ request }) => {
		const form = await request.formData();
		const parsed = parseForm(form);
		if ('error' in parsed) return fail(400, { error: parsed.error });

		const id = parseId(form);
		if (id === null) {
			db.insertSubscription(parsed.sub);
		} else {
			if (!db.getSubscription(id)) return fail(404, { error: 'That subscription no longer exists.' });
			db.updateSubscription(id, parsed.sub);
		}
		return { saved: true };
	},

	delete: async ({ request }) => {
		const id = parseId(await request.formData());
		if (id === null || !db.getSubscription(id)) {
			return fail(404, { error: 'That subscription no longer exists.' });
		}
		db.deleteSubscription(id);
		return { deleted: true };
	}
};
