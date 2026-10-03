<script lang="ts">
	import { tick } from 'svelte';
	import { enhance, type SubmitFunction } from '$app/forms';
	import { goto } from '$app/navigation';
	import { centsToInput, DEFAULT_CURRENCY, formatCents } from '#lib/money.ts';
	import { dayLabel, monthLabel } from '#lib/dates.ts';
	import MonthNav from '#lib/components/MonthNav.svelte';
	import { ui } from '#lib/ui.svelte.ts';
	import type { TransactionRow } from '#lib/types.ts';

	let { data } = $props();

	// Form state. `editingId` null = adding a new transaction.
	let open = $state(false);
	let editingId = $state<number | null>(null);
	let amount = $state('');
	let categoryId = $state('');
	let accountId = $state('');
	let date = $state('');
	let note = $state('');
	let error = $state('');
	let justSaved = $state(false);
	let amountInput = $state<HTMLInputElement>();
	let formEl = $state<HTMLFormElement>();

	async function openNew() {
		editingId = null;
		amount = '';
		categoryId = '';
		note = '';
		error = '';
		accountId ||= String(data.defaultAccountId ?? '');
		date ||= data.today;
		open = true;
		await tick();
		amountInput?.focus();
	}

	async function openEdit(t: TransactionRow) {
		editingId = t.id;
		amount = centsToInput(t.amount_cents);
		categoryId = String(t.category_id);
		accountId = String(t.account_id);
		date = t.date;
		note = t.note;
		error = '';
		open = true;
		await tick();
		amountInput?.focus();
	}

	function close() {
		open = false;
		editingId = null;
		error = '';
		date = ''; // back to today next time
	}

	// The global `n` shortcut lives in the layout; it raises this flag.
	$effect(() => {
		if (ui.newTransaction) {
			ui.newTransaction = false;
			openNew();
		}
	});

	function onWindowKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) close();
	}

	// Native forms only submit on Enter from text inputs; make Enter on a <select> submit too.
	function submitOnEnter(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			formEl?.requestSubmit();
		}
	}

	const submit: SubmitFunction = () => {
		return async ({ result, update }) => {
			if (result.type === 'failure') {
				error = String(result.data?.error ?? 'Something went wrong.');
				return;
			}
			await update({ reset: false });
			if (result.type !== 'success') return;
			if (editingId !== null || result.data?.deleted) {
				close();
			} else {
				// Stay open for the next entry; keep account and date.
				amount = '';
				categoryId = '';
				note = '';
				error = '';
				justSaved = true;
				setTimeout(() => (justSaved = false), 1500);
				amountInput?.focus();
			}
		};
	};

	const listUrl = (month: string, q: string) =>
		`/transactions?month=${month}` + (q ? `&q=${encodeURIComponent(q)}` : '');

	let searchTimer: ReturnType<typeof setTimeout>;
	function onSearch(e: Event) {
		const q = (e.currentTarget as HTMLInputElement).value.trim();
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => goto(listUrl(data.month, q), { replace: true, reset: false }), 250);
	}
</script>

<svelte:window onkeydown={onWindowKeydown} />

<div class="flex items-center justify-between gap-4">
	<h1 class="text-2xl font-bold">Transactions</h1>
	<button class="btn-primary text-lg" onclick={openNew} title="New transaction (n)">+ Add</button>
</div>

{#if open}
	<form
		bind:this={formEl}
		method="POST"
		action="?/save"
		use:enhance={submit}
		class="mt-5 rounded-xl border border-line bg-surface p-4 sm:p-5"
	>
		<input type="hidden" name="id" value={editingId ?? ''} />
		<div class="grid gap-3 sm:grid-cols-[10rem_12rem_1fr]">
			<label class="block">
				<span class="mb-1 block text-sm text-muted">Amount</span>
				<input
					bind:this={amountInput}
					bind:value={amount}
					name="amount"
					inputmode="decimal"
					autocomplete="off"
					placeholder="0.00"
					required
					class="field text-xl font-semibold tabular-nums"
				/>
			</label>
			<label class="block">
				<span class="mb-1 block text-sm text-muted">Category</span>
				<select bind:value={categoryId} name="category_id" required class="field" onkeydown={submitOnEnter}>
					<option value="" disabled>Choose…</option>
					{#each data.categories as c (c.id)}
						<option value={String(c.id)}>{c.name}</option>
					{/each}
				</select>
			</label>
			<label class="block">
				<span class="mb-1 block text-sm text-muted">Note</span>
				<input bind:value={note} name="note" maxlength="200" autocomplete="off" class="field" />
			</label>
		</div>
		<div class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-[10rem_12rem]">
			<label class="block">
				<span class="mb-1 block text-sm text-muted">Date</span>
				<input bind:value={date} name="date" type="date" required class="field" />
			</label>
			<label class="block">
				<span class="mb-1 block text-sm text-muted">Account</span>
				<select bind:value={accountId} name="account_id" required class="field" onkeydown={submitOnEnter}>
					{#each data.accounts as a (a.id)}
						<option value={String(a.id)}>{a.name}</option>
					{/each}
				</select>
			</label>
		</div>

		{#if error}<p class="mt-3 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>{/if}

		<div class="mt-4 flex flex-wrap items-center gap-2">
			<button class="btn-primary">{editingId === null ? 'Add' : 'Save'}</button>
			<button type="button" class="btn-ghost" onclick={close}>Cancel <span class="text-xs">(Esc)</span></button>
			{#if justSaved}<span class="text-sm text-muted">Added.</span>{/if}
			{#if editingId !== null}
				<button
					formaction="?/delete"
					formnovalidate
					class="btn-ghost ml-auto"
					onclick={(e) => {
						if (!confirm('Delete this transaction?')) e.preventDefault();
					}}>Delete</button
				>
			{/if}
		</div>
	</form>
{/if}

<div class="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
	<MonthNav month={data.month} href={(m) => listUrl(m, data.q)} />
	<input
		type="search"
		value={data.q}
		oninput={onSearch}
		placeholder="Search notes, categories, accounts"
		aria-label="Search"
		class="field sm:ml-auto sm:max-w-xs"
	/>
</div>

{#if data.transactions.length === 0}
	<p class="mt-10 text-center text-muted">
		{#if data.q}
			Nothing matches “{data.q}” in {monthLabel(data.month)}.
		{:else}
			No transactions this month. Press <kbd class="rounded border border-line px-1.5">n</kbd> or click + Add to log one.
		{/if}
	</p>
{:else}
	<ul class="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
		{#each data.transactions as t (t.id)}
			<li>
				<button
					class="flex w-full items-center gap-4 px-4 py-3.5 text-left hover:bg-bg {editingId === t.id ? 'bg-brand-soft' : ''}"
					onclick={() => openEdit(t)}
				>
					<div class="min-w-0 flex-1">
						<div class="truncate font-medium">
							{t.category_name}{#if t.note}<span class="font-normal text-muted">{' · '}{t.note}</span>{/if}
						</div>
						<div class="mt-0.5 text-sm text-muted">{dayLabel(t.date)} · {t.account_name}</div>
					</div>
					<div class="shrink-0 text-right text-lg font-semibold tabular-nums {t.amount_cents > 0 ? 'text-brand' : ''}">
						{t.amount_cents > 0 ? '+' : '−'}{formatCents(Math.abs(t.amount_cents))}
						{#if t.currency !== DEFAULT_CURRENCY}<span class="text-xs font-normal text-muted">{t.currency}</span>{/if}
					</div>
				</button>
			</li>
		{/each}
	</ul>
{/if}
