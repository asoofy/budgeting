<script lang="ts">
	import { enhance } from '$app/forms';
	import AccountRow from '#lib/components/AccountRow.svelte';
	import { formatCents } from '#lib/money.ts';
	import CategoryRow from '#lib/components/CategoryRow.svelte';
	import ImportCsv from '#lib/components/ImportCsv.svelte';

	let { data, form } = $props();

	let addInput = $state<HTMLInputElement>();

	const spending = $derived(data.categories.filter((c) => !c.is_income));
	const income = $derived(data.categories.filter((c) => c.is_income));

	let newCurrency = $state('SAR');

	const accountAddError = $derived(
		form && 'action' in form && form.action === 'addAccount' ? form.error : undefined
	);
	const accountError = (id: number) =>
		form && 'accountId' in form && form.accountId === id && 'error' in form ? form.error : undefined;

	const importResult = $derived(
		form && 'action' in form && form.action === 'import' && typeof form.imported === 'number'
			? { imported: form.imported, skipped: form.skipped!, failed: form.failed!, problems: form.problems! }
			: undefined
	);
	const importError = $derived(
		form && 'action' in form && form.action === 'import' && 'error' in form ? form.error : undefined
	);

	const exports = [
		{ name: 'transactions', label: 'Transactions' },
		{ name: 'subscriptions', label: 'Subscriptions' },
		{ name: 'accounts', label: 'Accounts' },
		{ name: 'categories', label: 'Categories' }
	];

	const addError = $derived(form && 'action' in form && form.action === 'add' ? form.error : undefined);
	const rowError = (id: number) =>
		form && 'id' in form && form.id === id && 'error' in form ? form.error : undefined;
</script>

<h1 class="text-2xl font-bold">Settings</h1>

<section class="mt-8">
	<div class="flex items-baseline justify-between gap-3">
		<h2 class="text-lg font-semibold">Accounts</h2>
		<span class="text-muted tabular-nums">Total <span class="font-semibold text-ink">{formatCents(data.accountsTotal)}</span> SAR</span>
	</div>

	<ul class="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
		{#each data.accounts as account (account.id)}
			<AccountRow {account} error={accountError(account.id)} />
		{/each}
	</ul>

	<form
		method="POST"
		action="?/addAccount"
		use:enhance={() => async ({ result, update }) => {
			await update();
			if (result.type === 'success') newCurrency = 'SAR';
		}}
		class="mt-3 flex flex-wrap items-end gap-3"
	>
		<input name="name" maxlength="40" required autocomplete="off" placeholder="New account" aria-label="New account name" class="field min-w-0 basis-full sm:basis-0 sm:flex-1 sm:max-w-xs" />
		<select bind:value={newCurrency} name="currency" aria-label="Currency" class="field w-24!">
			<option>SAR</option>
			<option>USD</option>
			<option>EGP</option>
		</select>
		<input name="starting_balance" inputmode="decimal" autocomplete="off" placeholder="Balance" aria-label="Starting balance" class="field w-32! text-right tabular-nums" />
		{#if newCurrency !== 'SAR'}
			<input name="rate_to_default" inputmode="decimal" autocomplete="off" placeholder="SAR rate" aria-label="1 {newCurrency} in SAR" class="field w-28! text-right tabular-nums" />
		{/if}
		<button class="btn-primary">+ Add</button>
	</form>
	{#if accountAddError}<p class="mt-2 text-sm font-medium text-red-600 dark:text-red-400">{accountAddError}</p>{/if}
</section>

<section class="mt-10">
	<h2 class="text-lg font-semibold">Categories</h2>

	<form
		method="POST"
		action="?/addCategory"
		use:enhance={() => async ({ result, update }) => {
			await update();
			if (result.type === 'success') addInput?.focus();
		}}
		class="mt-3 flex flex-wrap items-center gap-3"
	>
		<input
			bind:this={addInput}
			name="name"
			maxlength="40"
			required
			autocomplete="off"
			placeholder="New category"
			aria-label="New category name"
			class="field min-w-0 flex-1 sm:max-w-xs"
		/>
		<label class="flex items-center gap-2 text-muted">
			<input type="checkbox" name="is_income" class="size-4 accent-brand" /> Income
		</label>
		<button class="btn-primary">+ Add</button>
	</form>
	{#if addError}<p class="mt-2 text-sm font-medium text-red-600 dark:text-red-400">{addError}</p>{/if}

	{#each [{ title: 'Spending', list: spending }, { title: 'Income', list: income }] as group (group.title)}
		<h3 class="mt-6 mb-2 text-sm font-medium tracking-wide text-muted uppercase">{group.title}</h3>
		<ul class="divide-y divide-line rounded-xl border border-line bg-surface">
			{#each group.list as category (category.id)}
				<CategoryRow {category} error={rowError(category.id)} />
			{/each}
		</ul>
	{/each}
</section>

<section class="mt-10">
	<h2 class="text-lg font-semibold">Import and export</h2>

	<div class="mt-3">
		<ImportCsv accounts={data.accounts} result={importResult} error={importError} />
	</div>

	<div class="mt-4 rounded-xl border border-line bg-surface p-4">
		<h3 class="font-semibold">Export to CSV</h3>
		<div class="mt-3 flex flex-wrap gap-2">
			{#each exports as e (e.name)}
				<a href="/export/{e.name}" download class="btn-ghost border border-line">{e.label}</a>
			{/each}
		</div>
		<p class="mt-3 text-sm text-muted">For a full backup, copy <code>data/budgeting.db</code> instead.</p>
	</div>
</section>
