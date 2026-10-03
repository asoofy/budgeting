<script lang="ts">
	import { enhance } from '$app/forms';
	import { parseCsv } from '#lib/csv.ts';
	import { guessMapping, mapRow, type DateFormat, type Mapping } from '#lib/importer.ts';
	import { formatCents } from '#lib/money.ts';

	type Result = { imported: number; skipped: number; failed: number; problems: string[] } | undefined;

	let {
		accounts,
		result,
		error
	}: { accounts: { id: number; name: string }[]; result: Result; error: string | undefined } = $props();

	let fileName = $state('');
	let csv = $state('');
	let rows = $state<string[][]>([]);
	let hasHeader = $state(true);
	let accountId = $state('');
	let dateFormat = $state<DateFormat>('dmy');
	// Selected column per field, as a string index; '' = not mapped.
	let cols = $state({ date: '', amount: '', debit: '', credit: '', note: '', category: '' });
	let fileInput = $state<HTMLInputElement>();
	let readError = $state('');

	const dataRows = $derived(rows.slice(hasHeader ? 1 : 0));
	const headers = $derived(
		rows.length === 0
			? []
			: hasHeader
				? rows[0].map((h, i) => h.trim() || `Column ${i + 1}`)
				: rows[0].map((_, i) => `Column ${i + 1}`)
	);

	const col = (v: string) => (v === '' ? null : Number(v));
	const mapping = $derived<Mapping>({
		date: col(cols.date),
		amount: col(cols.amount),
		debit: col(cols.debit),
		credit: col(cols.credit),
		note: col(cols.note),
		category: col(cols.category),
		dateFormat
	});
	const mappingReady = $derived(mapping.date !== null && (mapping.amount !== null || mapping.debit !== null || mapping.credit !== null));

	// Same function the server uses, so the preview shows what will actually be imported.
	const mapped = $derived(mappingReady ? dataRows.map((r) => mapRow(r, mapping)) : []);
	const okCount = $derived(mapped.filter((m) => m.ok).length);
	const preview = $derived(mapped.slice(0, 5));

	async function onFile(e: Event) {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		readError = '';
		if (!file) return reset();
		if (file.size > 5_000_000) {
			readError = 'That file is over 5 MB. Split it into smaller files.';
			return reset();
		}
		fileName = file.name;
		csv = await file.text();
		rows = parseCsv(csv);
		if (rows.length < 2) {
			readError = 'No rows found in that file.';
			return reset();
		}
		hasHeader = true;
		accountId ||= String(accounts[0]?.id ?? '');
		autoMap();
	}

	function autoMap() {
		const g = guessMapping(headers, dataRows.slice(0, 50).map((r) => r[0] ?? ''));
		// Use the date column's own values to guess day/month order.
		const dateSamples = g.date === null ? [] : dataRows.slice(0, 200).map((r) => r[g.date!] ?? '');
		const s = (n: number | null) => (n === null ? '' : String(n));
		cols = { date: s(g.date), amount: s(g.amount), debit: s(g.debit), credit: s(g.credit), note: s(g.note), category: s(g.category) };
		dateFormat = guessMapping(headers, dateSamples).dateFormat;
	}

	function reset() {
		fileName = '';
		csv = '';
		rows = [];
		cols = { date: '', amount: '', debit: '', credit: '', note: '', category: '' };
		if (fileInput) fileInput.value = '';
	}

	const fields = [
		{ key: 'date', label: 'Date', required: true },
		{ key: 'amount', label: 'Amount', required: false },
		{ key: 'debit', label: 'Money out (debit)', required: false },
		{ key: 'credit', label: 'Money in (credit)', required: false },
		{ key: 'note', label: 'Note', required: false },
		{ key: 'category', label: 'Category', required: false }
	] as const;
</script>

<div class="rounded-xl border border-line bg-surface p-4">
	<h3 class="font-semibold">Import bank transactions</h3>
	<p class="mt-1 text-sm text-muted">Choose a CSV from your bank. Rows you already have are skipped, so it's safe to import the same file twice.</p>

	<input
		bind:this={fileInput}
		type="file"
		accept=".csv,.txt,text/csv"
		onchange={onFile}
		aria-label="CSV file"
		class="mt-3 block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-4 file:py-2.5 file:font-semibold file:text-brand"
	/>
	{#if readError}<p class="mt-2 text-sm font-medium text-red-600 dark:text-red-400">{readError}</p>{/if}

	{#if result && !rows.length}
		<div class="mt-4 rounded-lg bg-brand-soft p-3" role="status">
			<p class="font-semibold">
				Imported {result.imported} {result.imported === 1 ? 'transaction' : 'transactions'}.
			</p>
			<p class="text-sm text-muted">
				{result.skipped} already there{result.failed ? `, ${result.failed} couldn't be read` : ''}.
			</p>
			{#if result.problems.length}
				<ul class="mt-1 text-sm text-muted">
					{#each result.problems as p (p)}<li>{p}</li>{/each}
					{#if result.failed > result.problems.length}<li>…and {result.failed - result.problems.length} more</li>{/if}
				</ul>
			{/if}
		</div>
	{/if}

	{#if rows.length}
		<form
			method="POST"
			action="?/importCsv"
			use:enhance={() =>
				async ({ result: r, update }) => {
					await update({ reset: false });
					if (r.type === 'success') reset();
				}}
			class="mt-4 space-y-4"
		>
			<textarea name="csv" value={csv} hidden readonly></textarea>

			<label class="flex items-center gap-2">
				<input type="checkbox" name="has_header" bind:checked={hasHeader} onchange={autoMap} class="size-4 accent-brand" />
				First row is a header
			</label>

			<div class="grid gap-3 sm:grid-cols-2">
				{#each fields as f (f.key)}
					<label class="block">
						<span class="mb-1 block text-sm text-muted">{f.label}{f.required ? '' : ' (optional)'}</span>
						<select bind:value={cols[f.key]} name="col_{f.key}" class="field">
							<option value="">{f.required ? 'Choose a column…' : 'None'}</option>
							{#each headers as h, i (i)}<option value={String(i)}>{h}</option>{/each}
						</select>
					</label>
				{/each}
			</div>
			<p class="-mt-1 text-sm text-muted">Use either Amount (negative = spending), or Money out and Money in.</p>

			<div class="grid gap-3 sm:grid-cols-2">
				<label class="block">
					<span class="mb-1 block text-sm text-muted">Date format</span>
					<select bind:value={dateFormat} name="date_format" class="field">
						<option value="dmy">Day/Month/Year (03/10/2026 = 3 Oct)</option>
						<option value="mdy">Month/Day/Year (03/10/2026 = 10 Mar)</option>
						<option value="ymd">Year-Month-Day (2026-10-03)</option>
					</select>
				</label>
				<label class="block">
					<span class="mb-1 block text-sm text-muted">Import into account</span>
					<select bind:value={accountId} name="account_id" class="field">
						{#each accounts as a (a.id)}<option value={String(a.id)}>{a.name}</option>{/each}
					</select>
				</label>
			</div>

			{#if mappingReady}
				<div>
					<div class="mb-1 text-sm text-muted">Preview (first 5 of {dataRows.length} rows)</div>
					<ul class="divide-y divide-line rounded-lg border border-line text-sm">
						{#each preview as p, i (i)}
							<li class="flex items-center justify-between gap-3 px-3 py-2">
								{#if p.ok}
									<span class="min-w-0 truncate"><span class="text-muted">{p.date}</span> {p.note || '(no note)'}{p.categoryName ? ` · ${p.categoryName}` : ''}</span>
									<span class="shrink-0 font-semibold tabular-nums {p.amount_cents > 0 ? 'text-brand' : ''}">{p.amount_cents > 0 ? '+' : '−'}{formatCents(Math.abs(p.amount_cents))}</span>
								{:else}
									<span class="text-red-600 dark:text-red-400">Row {i + 1 + (hasHeader ? 1 : 0)}: {p.error}</span>
								{/if}
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if error}<p class="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>{/if}

			<div class="flex flex-wrap items-center gap-2">
				<button class="btn-primary" disabled={!mappingReady || okCount === 0}>
					Import {mappingReady ? okCount : ''} {okCount === 1 ? 'row' : 'rows'}
				</button>
				<button type="button" class="btn-ghost" onclick={reset}>Cancel</button>
				{#if mappingReady && okCount < dataRows.length}
					<span class="text-sm text-muted">{dataRows.length - okCount} {dataRows.length - okCount === 1 ? 'row' : 'rows'} can't be read and will be skipped.</span>
				{/if}
			</div>
		</form>
	{/if}
</div>
