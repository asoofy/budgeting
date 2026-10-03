// Client-side UI signals shared between the layout and pages.
export const ui = $state({
	/** Set by the global `n` shortcut; the Transactions page opens its add form and clears it. */
	newTransaction: false
});

/** True when a key press is meant for a text field, not a shortcut. */
export function isTyping(target: EventTarget | null): boolean {
	return (
		target instanceof HTMLElement &&
		(target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
	);
}
