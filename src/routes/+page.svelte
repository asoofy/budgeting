<script lang="ts">
	import { goto } from '$app/navigation';
	import { DEFAULT_CURRENCY, formatCents } from '#lib/money.ts';
	import { dayLabel, monthLabel } from '#lib/dates.ts';
	import { ui } from '#lib/ui.svelte.ts';

	let { data } = $props();

	const barColor = { ok: 'bg-green-600', warn: 'bg-amber-500', over: 'bg-red-600' } as const;

	function add() {
		ui.newTransaction = true;
		goto('/transactions');
	}
</script>

<div class="flex items-center justify-between gap-4">
	<h1 class="text-2xl font-bold">{monthLabel(data.month)}</h1>
	<button class="btn-primary text-lg" onclick={add} title="New transaction (n)">+ Add</button>
</div>

<div class="mt-4 grid grid-cols-3 gap-3">
	<div class="rounded-xl border border-line bg-surface px-4 py-3">
		<div class="text-sm text-muted">Income</div>
		<div class="mt-1 text-xl font-bold tabular-nums sm:text-3xl">{formatCents(data.income)}</div>
	</div>
	<div class="rounded-xl border border-line bg-surface px-4 py-3">
		<div class="text-sm text-muted">Spent</div>
		<div class="mt-1 text-xl font-bold tabular-nums sm:text-3xl">{formatCents(data.spent)}</div>
	</div>
	<div class="rounded-xl border border-brand/40 bg-brand-soft px-4 py-3">
		<div class="text-sm text-muted">Left</div>
		<div class="mt-1 text-xl font-bold tabular-nums sm:text-3xl">{formatCents(data.left)}</div>
	</div>
</div>

<div class="mt-4 grid gap-4 md:grid-cols-2">
	<section>
		<h2 class="mb-2 text-sm font-medium tracking-wide text-muted uppercase">
			<a href="/budgets" class="hover:text-ink">Budgets</a>
		</h2>
		<div class="rounded-xl border border-line bg-surface p-4">
			{#if data.budgets.length === 0}
				<p class="text-muted">Set a monthly limit on the <a href="/budgets" class="text-brand underline">Budgets</a> page to track it here.</p>
			{:else}
				<ul class="space-y-2.5">
					{#each data.budgets as b (b.id)}
						<li>
							<div class="flex justify-between text-sm">
								<span class="font-medium">{b.name}</span>
								<span class="text-muted tabular-nums">{formatCents(b.spent)} / {formatCents(b.limit ?? 0)}</span>
							</div>
							<div class="mt-1 h-2.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-label="{b.name} budget used" aria-valuenow={Math.round(b.status!.percent)} aria-valuemin="0" aria-valuemax="100">
								<div class="h-full rounded-full {barColor[b.status!.state]}" style="width: {b.status!.percent}%"></div>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</section>

	<div class="space-y-4">
		<section>
			<h2 class="mb-2 text-sm font-medium tracking-wide text-muted uppercase">
				<a href="/subscriptions" class="hover:text-ink">Renews in the next 7 days</a>
			</h2>
			<div class="rounded-xl border border-line bg-surface">
				{#if data.renewals.length === 0}
					<p class="p-4 text-muted">Nothing renews in the next 7 days.</p>
				{:else}
					<ul class="divide-y divide-line">
						{#each data.renewals.slice(0, 3) as s (s.id)}
							<li class="flex items-center justify-between gap-3 px-4 py-2">
								<span class="truncate font-medium">{s.name}</span>
								<span class="shrink-0 text-sm text-muted">
									{s.next_renewal === data.today ? 'Today' : dayLabel(s.next_renewal)} ·
									<span class="font-semibold text-ink tabular-nums">{formatCents(s.amount_cents)}{s.currency !== DEFAULT_CURRENCY ? ' ' + s.currency : ''}</span>
								</span>
							</li>
						{/each}
					</ul>
					{#if data.renewals.length > 3}
						<a href="/subscriptions" class="block border-t border-line px-4 py-2 text-sm text-muted hover:text-ink">+{data.renewals.length - 3} more</a>
					{/if}
				{/if}
			</div>
		</section>

		<section>
			<h2 class="mb-2 text-sm font-medium tracking-wide text-muted uppercase">
				<a href="/transactions" class="hover:text-ink">Last 5 transactions</a>
			</h2>
			<div class="rounded-xl border border-line bg-surface">
				{#if data.recent.length === 0}
					<p class="p-4 text-muted">No transactions yet. Press <kbd class="rounded border border-line px-1.5">n</kbd> to log one.</p>
				{:else}
					<ul class="divide-y divide-line">
						{#each data.recent as t (t.id)}
							<li class="flex items-center gap-3 px-4 py-2">
								<span class="min-w-0 flex-1 truncate font-medium">{t.category_name}{#if t.note}<span class="font-normal text-muted">{' · '}{t.note}</span>{/if}</span>
								<span class="shrink-0 text-xs text-muted">{dayLabel(t.date)}</span>
								<span class="w-24 shrink-0 text-right font-semibold tabular-nums {t.amount_cents > 0 ? 'text-brand' : ''}">
									{t.amount_cents > 0 ? '+' : '−'}{formatCents(Math.abs(t.amount_cents))}{#if t.currency !== DEFAULT_CURRENCY}<span class="text-xs font-normal text-muted"> {t.currency}</span>{/if}
								</span>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</section>
	</div>
</div>
