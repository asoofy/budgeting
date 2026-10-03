<script lang="ts">
	import { tick } from 'svelte';
	import { enhance, type SubmitFunction } from '$app/forms';
	import { goto } from '$app/navigation';
	import { centsToInput, DEFAULT_CURRENCY, formatCents } from '#lib/money.ts';
	import { dayLabel } from '#lib/dates.ts';
	import type { SubscriptionRow } from '#lib/types.ts';

	let { data } = $props();

	let open = $state(false);
	let editingId = $state<number | null>(null);
	let name = $state('');
	let amount = $state('');
	let cycle = $state('monthly');
	let nextRenewal = $state('');
	let categoryId = $state('');
	let accountId = $state('');
	let autoLog = $state(true);
	let active = $state(true);
	let error = $state('');
	let nameInput = $state<HTMLInputElement>();

	async function openNew() {
		editingId = null;
		name = '';
		amount = '';
		cycle = 'monthly';
		nextRenewal = data.today;
		// Most subscriptions are "Subscriptions"; preselect it when it exists.
		categoryId = String(data.categories.find((c) => c.name === 'Subscriptions')?.id ?? '');
		accountId = String(data.defaultAccountId ?? '');
		autoLog = true;
		active = true;
		error = '';
		open = true;
		await tick();
		nameInput?.focus();
	}

	async function openEdit(s: SubscriptionRow) {
		editingId = s.id;
		name = s.name;
		amount = centsToInput(s.amount_cents);
		cycle = s.cycle;
		nextRenewal = s.next_renewal;
		categoryId = String(s.category_id);
		accountId = String(s.account_id);
		autoLog = s.auto_log === 1;
		active = s.active === 1;
		error = '';
		open = true;
		await tick();
		nameInput?.focus();
	}

	function close() {
		open = false;
		editingId = null;
		error = '';
	}

	function onWindowKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) close();
	}

	const submit: SubmitFunction = () => {
		return async ({ result, update }) => {
			if (result.type === 'failure') {
				error = String(result.data?.error ?? 'Something went wrong.');
				return;
			}
			await update({ reset: false });
			if (result.type === 'success') close();
		};
	};

	let searchTimer: ReturnType<typeof setTimeout>;
	function onSearch(e: Event) {
		const q = (e.currentTarget as HTMLInputElement).value.trim();
		clearTimeout(searchTimer);
		searchTimer = setTimeout(
			() => goto(q ? `/subscriptions?q=${encodeURIComponent(q)}` : '/subscriptions', { replace: true, reset: false }),
			250
		);
	}

	const cycleWord = { weekly: 'week', monthly: 'month', yearly: 'year' } as const;
	const money = (s: SubscriptionRow) =>
		`${formatCents(s.amount_cents)}${s.currency !== DEFAULT_CURRENCY ? ' ' + s.currency : ''}`;
</script>

<svelte:window onkeydown={onWindowKeydown} />

<div class="flex items-center justify-between gap-4">
	<h1 class="text-2xl font-bold">Subscriptions</h1>
	<button class="btn-primary text-lg" onclick={openNew}>+ Add</button>
</div>

{#if open}
	<form
		method="POST"
		action="?/save"
		use:enhance={submit}
		class="mt-5 rounded-xl border border-line bg-surface p-4 sm:p-5"
	>
		<input type="hidden" name="id" value={editingId ?? ''} />
		<div class="grid gap-3 sm:grid-cols-[1fr_10rem_10rem]">
			<label class="block">
				<span class="mb-1 block text-sm text-muted">Name</span>
				<input bind:this={nameInput} bind:value={name} name="name" maxlength="60" required autocomplete="off" class="field" />
			</label>
			<label class="block">
				<span class="mb-1 block text-sm text-muted">Amount</span>
				<input bind:value={amount} name="amount" inputmode="decimal" placeholder="0.00" required autocomplete="off" class="field tabular-nums" />
			</label>
			<label class="block">
				<span class="mb-1 block text-sm text-muted">Billed</span>
				<select bind:value={cycle} name="cycle" class="field">
					<option value="weekly">Weekly</option>
					<option value="monthly">Monthly</option>
					<option value="yearly">Yearly</option>
				</select>
			</label>
		</div>
		<div class="mt-3 grid gap-3 sm:grid-cols-3">
			<label class="block">
				<span class="mb-1 block text-sm text-muted">Next renewal</span>
				<input bind:value={nextRenewal} name="next_renewal" type="date" required class="field" />
			</label>
			<label class="block">
				<span class="mb-1 block text-sm text-muted">Category</span>
				<select bind:value={categoryId} name="category_id" required class="field">
					<option value="" disabled>Choose…</option>
					{#each data.categories as c (c.id)}
						<option value={String(c.id)}>{c.name}</option>
					{/each}
				</select>
			</label>
			<label class="block">
				<span class="mb-1 block text-sm text-muted">Account</span>
				<select bind:value={accountId} name="account_id" required class="field">
					{#each data.accounts as a (a.id)}
						<option value={String(a.id)}>{a.name}</option>
					{/each}
				</select>
			</label>
		</div>
		<div class="mt-4 flex flex-wrap gap-x-6 gap-y-2">
			<label class="flex items-center gap-2">
				<input type="checkbox" name="auto_log" bind:checked={autoLog} class="size-4 accent-brand" />
				Log a transaction when it renews
			</label>
			<label class="flex items-center gap-2">
				<input type="checkbox" name="active" bind:checked={active} class="size-4 accent-brand" />
				Active
			</label>
		</div>

		{#if error}<p class="mt-3 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>{/if}

		<div class="mt-4 flex flex-wrap items-center gap-2">
			<button class="btn-primary">{editingId === null ? 'Add' : 'Save'}</button>
			<button type="button" class="btn-ghost" onclick={close}>Cancel <span class="text-xs">(Esc)</span></button>
			{#if editingId !== null}
				<button
					formaction="?/delete"
					formnovalidate
					class="btn-ghost ml-auto"
					onclick={(e) => {
						if (!confirm('Delete this subscription? Transactions it already logged stay.')) e.preventDefault();
					}}>Delete</button
				>
			{/if}
		</div>
	</form>
{/if}

{#if data.subscriptions.length > 0 || data.q}
	<div class="mt-6 grid grid-cols-2 gap-3">
		<div class="rounded-xl border border-line bg-surface p-4">
			<div class="text-sm text-muted">Per month</div>
			<div class="mt-1 text-2xl font-bold tabular-nums sm:text-3xl">{formatCents(data.totals.monthly)}</div>
		</div>
		<div class="rounded-xl border border-line bg-surface p-4">
			<div class="text-sm text-muted">Per year</div>
			<div class="mt-1 text-2xl font-bold tabular-nums sm:text-3xl">{formatCents(data.totals.yearly)}</div>
		</div>
	</div>

	{#if data.soon.length > 0}
		<section class="mt-6">
			<h2 class="mb-2 text-sm font-medium tracking-wide text-muted uppercase">Renews in the next 7 days</h2>
			<ul class="divide-y divide-line rounded-xl border border-brand/40 bg-brand-soft">
				{#each data.soon as s (s.id)}
					<li class="flex items-center justify-between gap-4 px-4 py-3">
						<span class="font-medium">{s.name}</span>
						<span class="text-right text-sm text-muted">
							{s.next_renewal === data.today ? 'Today' : dayLabel(s.next_renewal)} ·
							<span class="font-semibold text-ink tabular-nums">{money(s)}</span>
						</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<div class="mt-6">
		<input
			type="search"
			value={data.q}
			oninput={onSearch}
			placeholder="Search subscriptions"
			aria-label="Search"
			class="field sm:max-w-xs"
		/>
	</div>
{/if}

{#if data.subscriptions.length === 0}
	<p class="mt-10 text-center text-muted">
		{#if data.q}
			Nothing matches “{data.q}”.
		{:else}
			No subscriptions yet. Click + Add to track your first one.
		{/if}
	</p>
{:else}
	<ul class="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
		{#each data.subscriptions as s (s.id)}
			<li>
				<button
					class="flex w-full items-center gap-4 px-4 py-3.5 text-left hover:bg-bg {editingId === s.id ? 'bg-brand-soft' : ''} {s.active ? '' : 'opacity-60'}"
					onclick={() => openEdit(s)}
				>
					<div class="min-w-0 flex-1">
						<div class="truncate font-medium">
							{s.name}{#if !s.active}<span class="ml-2 rounded bg-line px-1.5 py-0.5 text-xs font-normal text-muted">Paused</span>{/if}
						</div>
						<div class="mt-0.5 text-sm text-muted">
							{s.active ? `Renews ${dayLabel(s.next_renewal)}` : s.category_name}{s.auto_log || !s.active ? '' : ' · not auto-logged'}
						</div>
					</div>
					<div class="shrink-0 text-right">
						<div class="text-lg font-semibold tabular-nums">{money(s)}</div>
						<div class="text-sm text-muted">per {cycleWord[s.cycle]}</div>
					</div>
				</button>
			</li>
		{/each}
	</ul>
{/if}
