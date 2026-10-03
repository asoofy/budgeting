<script lang="ts">
	import '../app.css';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { isTyping, ui } from '#lib/ui.svelte.ts';

	let { children } = $props();

	const links = [
		{ href: '/', label: 'Dashboard' },
		{ href: '/transactions', label: 'Transactions' },
		{ href: '/subscriptions', label: 'Subscriptions' },
		{ href: '/budgets', label: 'Budgets' }
	];

	const isActive = (href: string) =>
		href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);

	function onkeydown(e: KeyboardEvent) {
		if (e.key !== 'n' || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
		e.preventDefault();
		ui.newTransaction = true;
		if (page.url.pathname !== '/transactions') goto('/transactions');
	}
</script>

<svelte:window {onkeydown} />

<header class="border-b border-line bg-surface">
	<div class="mx-auto flex max-w-4xl items-center gap-6 px-4 py-3">
		<a href="/" class="text-lg font-bold tracking-tight">Budgeting</a>
		<nav class="hidden gap-1 sm:flex">
			{#each links as link (link.href)}
				<a
					href={link.href}
					class="rounded-lg px-3 py-2 text-sm font-medium {isActive(link.href)
						? 'bg-brand-soft text-brand'
						: 'text-muted hover:text-ink'}">{link.label}</a
				>
			{/each}
		</nav>
		<a
			href="/settings"
			aria-label="Settings"
			class="ml-auto rounded-lg p-2 text-muted hover:text-ink {isActive('/settings') ? 'text-brand' : ''}"
		>
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<circle cx="12" cy="12" r="3" />
				<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
			</svg>
		</a>
	</div>
</header>

<main class="mx-auto max-w-4xl px-4 pt-6 pb-24 sm:pb-6">
	{@render children()}
</main>

<!-- Phone: the same 4 links as a bottom bar -->
<nav class="fixed inset-x-0 bottom-0 grid grid-cols-4 border-t border-line bg-surface sm:hidden">
	{#each links as link (link.href)}
		<a
			href={link.href}
			class="py-3.5 text-center text-xs font-medium {isActive(link.href) ? 'text-brand' : 'text-muted'}"
			>{link.label}</a
		>
	{/each}
</nav>
