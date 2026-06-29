// Compatibility shim for a previously deployed preview HTML that references
// this hashed entry file. The real entry is now emitted with a stable filename
// to prevent Lovable preview white screens caused by stale/missing hashed assets.
import("./index.js");