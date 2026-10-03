<script lang="ts">
	import { enhance } from '$app/forms';
	import type { CategoryWithUsage } from '#lib/types.ts';

	let { category, error }: { category: CategoryWithUsage; error?: string } = $props();

	// Editable copy of the name; resets whenever the saved name changes.
	let name = $derived(category.name);
	const dirty = $derived(name.trim() !== category.name);

	const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
	const usage = $derived(
		[
			category.tx_count && plural(category.tx_count, 'transaction'),
			category.sub_count && plural(category.sub_count, 'subscription')
		]
			.filter(Boolean)
			.join(' and ')
	);

	function confirmDelete(e: MouseEvent) {
		const message = usage
			? `Delete "${category.name}"? Its ${usage} will move to "${category.fallback_name}".`
			: `Delete "${category.name}"?`;
		if (!confirm(message)) e.preventDefault();
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			name = category.name;
			(e.currentTarget as HTMLInputElement).blur();
		}
	}
</script>

<li class="px-4 py-3">
	<form
		method="POST"
		action="?/renameCategory"
		use:enhance={() => ({ update }) => update({ reset: false })}
		class="flex items-center gap-2"
	>
		<input type="hidden" name="id" value={category.id} />
		<input
			bind:value={name}
			{onkeydown}
			name="name"
			maxlength="40"
			autocomplete="off"
			aria-label="Category name"
			class="field min-w-0 flex-1 sm:max-w-xs"
		/>
		{#if dirty}<button class="btn-primary">Save</button>{/if}
		<button
			formaction="?/deleteCategory"
			formnovalidate
			class="btn-ghost ml-auto disabled:opacity-40"
			disabled={!category.fallback_name}
			title={category.fallback_name ? undefined : 'You need at least one category of this type'}
			onclick={confirmDelete}>Delete</button
		>
	</form>
	<p class="mt-1 text-sm {error ? 'font-medium text-red-600 dark:text-red-400' : 'text-muted'}">
		{error ?? (usage || 'Not used yet')}
	</p>
</li>
