<script lang="ts">
	import { enhance } from '$app/forms';
	import { centsToInput, formatCents, toDefault } from '#lib/money.ts';
	import type { AccountWithBalance } from '#lib/types.ts';

	let { account, error }: { account: AccountWithBalance; error?: string } = $props();

	// Editable copies; they reset to the saved values whenever the account changes.
	let name = $derived(account.name);
	let currency = $derived(account.currency);
	let starting = $derived(account.starting_balance === 0 ? '' : centsToSigned(account.starting_balance));
	let rate = $derived(String(account.rate_to_default));

	function centsToSigned(cents: number) {
		return (cents < 0 ? '-' : '') + centsToInput(cents);
	}

	const dirty = $derived(
		name.trim() !== account.name ||
			currency !== account.currency ||
			starting.trim() !== (account.starting_balance === 0 ? '' : centsToSigned(account.starting_balance)) ||
			(currency !== 'SAR' && rate.trim() !== String(account.rate_to_default))
	);

	function confirmDelete(e: MouseEvent) {
		if (!confirm(`Delete the account "${account.name}"?`)) e.preventDefault();
	}
</script>

<li class="px-4 py-4">
	<form
		method="POST"
		action="?/saveAccount"
		use:enhance={() => ({ update }) => update({ reset: false })}
		class="space-y-3"
	>
		<input type="hidden" name="id" value={account.id} />
		<div class="flex items-center gap-3">
			<input bind:value={name} name="name" maxlength="40" autocomplete="off" aria-label="Account name" class="field min-w-0 flex-1" />
			<div class="shrink-0 text-right">
				<div class="text-xl font-bold tabular-nums">{formatCents(account.balance)} <span class="text-sm font-normal text-muted">{account.currency}</span></div>
				{#if account.currency !== 'SAR'}
					<div class="text-sm text-muted tabular-nums">≈ {formatCents(toDefault(account.balance, account.rate_to_default))} SAR</div>
				{/if}
			</div>
		</div>

		<div class="flex flex-wrap items-end gap-3">
			<label class="block">
				<span class="mb-1 block text-xs text-muted">Currency</span>
				<select bind:value={currency} name="currency" class="field w-24!">
					<option>SAR</option>
					<option>USD</option>
					<option>EGP</option>
				</select>
			</label>
			<label class="block">
				<span class="mb-1 block text-xs text-muted">Starting balance</span>
				<input bind:value={starting} name="starting_balance" inputmode="decimal" autocomplete="off" placeholder="0.00" class="field w-36! text-right tabular-nums" />
			</label>
			{#if currency !== 'SAR'}
				<label class="block">
					<span class="mb-1 block text-xs text-muted">1 {currency} = ? SAR</span>
					<input bind:value={rate} name="rate_to_default" inputmode="decimal" autocomplete="off" class="field w-28! text-right tabular-nums" />
				</label>
			{/if}
			{#if dirty}<button class="btn-primary">Save</button>{/if}
			<button formaction="?/deleteAccount" formnovalidate class="btn-ghost ml-auto" onclick={confirmDelete}>Delete</button>
		</div>
	</form>
	{#if error}<p class="mt-2 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>{/if}
</li>
