// Local stub to avoid the deprecated npm registry dependency.
// Modern Node.js versions have a native global DOMException.
const NativeDOMException = globalThis.DOMException;

// Export for CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NativeDOMException;
}

// Export for ESM if imported as an ES module
export default NativeDOMException;
export { NativeDOMException as DOMException };
