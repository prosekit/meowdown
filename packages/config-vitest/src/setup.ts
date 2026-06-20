// WebKit (JavaScriptCore) lacks Symbol.dispose / Symbol.asyncDispose. Define them
// so the lowered `using` helper and a fixture's [Symbol.dispose] resolve to the
// same key. No-op on engines that already provide them.
const symbolTarget: { dispose?: symbol; asyncDispose?: symbol } = Symbol

if (symbolTarget.dispose == null) {
  symbolTarget.dispose = Symbol.for('Symbol.dispose')
}
if (symbolTarget.asyncDispose == null) {
  symbolTarget.asyncDispose = Symbol.for('Symbol.asyncDispose')
}
