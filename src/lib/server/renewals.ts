import { dueSubscriptions, db, insertTransaction, setNextRenewal } from './db.ts';
import { today } from '#lib/dates.ts';
import { dueDates, nextRenewalAfter, recentRenewals } from '#lib/renewals.ts';

/**
 * Logs a transaction for every renewal that has come due (if the subscription has auto_log on)
 * and moves next_renewal into the future. Safe to call repeatedly: once next_renewal is ahead
 * of today there is nothing left to do. Covers renewals missed while the app was closed.
 */
export function processRenewals() {
	const now = today();
	const due = dueSubscriptions(now);
	if (due.length === 0) return;

	db.transaction(() => {
		for (const sub of due) {
			const dates = dueDates(sub.next_renewal, sub.cycle, now);
			if (sub.auto_log) {
				for (const date of recentRenewals(dates, now)) {
					insertTransaction(
						{
							account_id: sub.account_id,
							category_id: sub.category_id,
							amount_cents: -sub.amount_cents,
							date,
							note: sub.name
						},
						sub.id
					);
				}
			}
			setNextRenewal(sub.id, nextRenewalAfter(dates[dates.length - 1], sub.cycle));
		}
	})();
}
