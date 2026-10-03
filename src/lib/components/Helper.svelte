<script lang="ts">
	import { enhance } from '$app/forms';
	import { DEFAULT_CURRENCY, formatCents } from '#lib/money.ts';

	type Overspent = { id: number; name: string; over: number; saving: number };
	type Review = {
		id: number;
		name: string;
		cycle: string;
		amount_cents: number;
		currency: string;
		used: boolean;
		saving: number;
	};

	let {
		overspent,
		reviews,
		month,
		monthText
	}: { overspent: Overspent[]; reviews: Review[]; month: string; monthText: string } = $props();

	const unused = $derived(reviews.filter((r) => !r.used));
	const unusedSaving = $derived(unused.reduce((sum, r) => sum + r.saving, 0));
	const perWord: Record<string, string> = { weekly: 'week', monthly: 'month', yearly: 'year' };
</script>

<section class="mt-10">
	<h2 class="text-lg font-semibold">Where you could cut</h2>

	<h3 class="mt-4 mb-2 text-sm font-medium tracking-wide text-muted uppercase">Over budget in {monthText}</h3>
	{#if overspent.length === 0}
		<p class="rounded-xl border border-line bg-surface p-4 text-muted">Nothing is over its limit this month.</p>
	{:else}
		<ul class="divide-y divide-line rounded-xl border border-line bg-surface">
			{#each overspent as o (o.id)}
				<li class="px-4 py-3">
					<div class="flex justify-between gap-3">
						<span class="font-medium">{o.name}</span>
						<span class="font-medium text-red-600 tabular-nums dark:text-red-400">{formatCents(o.over)} over</span>
					</div>
					<p class="mt-0.5 text-sm text-muted">
						If you kept {o.name} to its limit, you'd save about
						<span class="font-semibold text-ink tabular-nums">{formatCents(o.saving)}</span> a year at this pace.
					</p>
				</li>
			{/each}
		</ul>
	{/if}

	<h3 class="mt-6 mb-1 text-sm font-medium tracking-wide text-muted uppercase">Subscriptions you used this month</h3>
	{#if reviews.length === 0}
		<p class="rounded-xl border border-line bg-surface p-4 text-muted">No active subscriptions to review.</p>
	{:else}
		<p class="mb-2 text-sm text-muted">Tick the ones you used. The rest are cut candidates.</p>
		<ul class="divide-y divide-line rounded-xl border border-line bg-surface">
			{#each reviews as r (r.id)}
				<li>
					<form method="POST" action="?/review&month={month}" use:enhance={() => ({ update }) => update({ reset: false })}>
						<input type="hidden" name="id" value={r.id} />
						<label class="flex cursor-pointer items-center gap-3 px-4 py-3">
							<input
								type="checkbox"
								name="used"
								checked={r.used}
								onchange={(e) => e.currentTarget.form?.requestSubmit()}
								class="size-5 shrink-0 accent-brand"
							/>
							<span class="min-w-0 flex-1">
								<span class="block truncate font-medium {r.used ? 'text-muted' : ''}">{r.name}</span>
								<span class="block text-sm text-muted tabular-nums">
									{formatCents(r.amount_cents)}{r.currency !== DEFAULT_CURRENCY ? ' ' + r.currency : ''} per {perWord[r.cycle]}
								</span>
							</span>
							{#if !r.used}
								<span class="shrink-0 text-right text-sm text-muted">
									Cut it, save
									<span class="block text-base font-semibold text-ink tabular-nums">{formatCents(r.saving)} / year</span>
								</span>
							{/if}
						</label>
					</form>
				</li>
			{/each}
		</ul>
		{#if unused.length > 0}
			<p class="mt-3 text-sm text-muted">
				Cutting all {unused.length} unticked would save
				<span class="font-semibold text-ink tabular-nums">{formatCents(unusedSaving)}</span> a year.
			</p>
		{/if}
	{/if}
</section>
