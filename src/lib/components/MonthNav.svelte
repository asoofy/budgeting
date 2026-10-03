<script lang="ts">
	import { monthLabel, shiftMonth } from '#lib/dates.ts';

	let { month, href }: { month: string; href: (month: string) => string } = $props();
</script>

<div class="flex items-center gap-1">
	<a href={href(shiftMonth(month, -1))} class="btn-ghost px-3" aria-label="Previous month">‹</a>
	<span class="min-w-36 text-center font-semibold">{monthLabel(month)}</span>
	<a href={href(shiftMonth(month, 1))} class="btn-ghost px-3" aria-label="Next month">›</a>
</div>
