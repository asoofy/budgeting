<script lang="ts">
	import { enhance } from '$app/forms';
	import Helper from '#lib/components/Helper.svelte';
	import MonthNav from '#lib/components/MonthNav.svelte';
	import { centsToInput, formatCents } from '#lib/money.ts';
	import { budgetStatus } from '#lib/budget.ts';
	import { monthLabel } from '#lib/dates.ts';

	let { data, form } = $props();

	// Limit being typed per category id. Absent = untouched (shows the saved value).
	let edits = $state<Record<number, string>>({});

	const savedText = (limit: number | null) => (limit === null ? '' : centsToInput(limit));
	const valueFor = (id: number, limit: number | null) => edits[id] ?? savedText(limit);
	const isDirty = (id: number, limit: number | null) =>
		id in edits && edits[id].trim() !== savedText(limit);

	const rowError = (id: number) => (form && 'id' in form && form.id === id && 'error' in form ? form.error : undefined);

	const barColor = { ok: 'bg-green-600', warn: 'bg-amber-500', over: 'bg-red-600' } as const;
	const textColor = { ok: 'text-green-700 dark:text-green-400', warn: 'text-amber-600 dark:text-amber-400', over: 'text-red-600 dark:text-red-400' } as const;

	const total = $derived(data.totalLimit > 0 ? budgetStatus(data.totalSpent, data.totalLimit) : null);
	const href = (m: string) => `/budgets?month=${m}`;
</script>

<h1 class="text-2xl font-bold">Budgets</h1>

<div class="mt-5">
	<MonthNav month={data.month} {href} />
</div>

{#if total}
	<div class="mt-5 rounded-xl border border-line bg-surface p-4">
		<div class="text-sm text-muted">Budgeted categories</div>
		<div class="mt-1 flex flex-wrap items-baseline gap-x-2">
			<span class="text-3xl font-bold tabular-nums">{formatCents(data.totalSpent)}</span>
			<span class="text-muted">of {formatCents(data.totalLimit)}</span>
			<span class="ml-auto font-semibold tabular-nums {textColor[total.state]}">
				{total.left >= 0 ? `${formatCents(total.left)} left` : `${formatCents(-total.left)} over`}
			</span>
		</div>
	</div>
{/if}

<ul class="mt-5 divide-y divide-line rounded-xl border border-line bg-surface">
	{#each data.rows as r (r.id)}
		<li class="px-4 py-4">
			<form
				method="POST"
				action="?/setBudget&month={data.month}"
				use:enhance={() =>
					async ({ result, update }) => {
						await update({ reset: false });
						if (result.type === 'success') delete edits[r.id];
					}}
				class="flex items-center gap-3"
			>
				<input type="hidden" name="id" value={r.id} />
				<span class="min-w-0 flex-1 truncate font-medium">{r.name}</span>
				<input
					name="limit"
					inputmode="decimal"
					autocomplete="off"
					placeholder="No limit"
					aria-label="Monthly limit for {r.name}"
					value={valueFor(r.id, r.limit)}
					oninput={(e) => (edits[r.id] = e.currentTarget.value)}
					onkeydown={(e) => {
						if (e.key === 'Escape') {
							delete edits[r.id];
							e.currentTarget.blur();
						}
					}}
					class="field w-28! text-right tabular-nums"
				/>
				{#if isDirty(r.id, r.limit)}<button class="btn-primary px-4">Save</button>{/if}
			</form>

			{#if r.status}
				<div
					class="mt-3 h-3 overflow-hidden rounded-full bg-line"
					role="progressbar"
					aria-valuenow={Math.round(r.status.percent)}
					aria-valuemin="0"
					aria-valuemax="100"
					aria-label="{r.name} budget used"
				>
					<div class="h-full rounded-full {barColor[r.status.state]}" style="width: {r.status.percent}%"></div>
				</div>
				<div class="mt-1.5 flex justify-between text-sm">
					<span class="text-muted tabular-nums">{formatCents(r.spent)} spent</span>
					<span class="font-medium tabular-nums {textColor[r.status.state]}">
						{r.status.left >= 0 ? `${formatCents(r.status.left)} left` : `${formatCents(-r.status.left)} over`}
					</span>
				</div>
			{:else}
				<p class="mt-1 text-sm text-muted tabular-nums">
					{r.spent > 0 ? `${formatCents(r.spent)} spent · ` : ''}Type a monthly limit to track this category.
				</p>
			{/if}

			{#if rowError(r.id)}<p class="mt-1 text-sm font-medium text-red-600 dark:text-red-400">{rowError(r.id)}</p>{/if}
		</li>
	{/each}
</ul>

<Helper overspent={data.overspent} reviews={data.reviews} month={data.month} monthText={monthLabel(data.month)} />

<p class="mt-8 text-sm text-muted">Limits repeat every month. Income categories don't have budgets.</p>
