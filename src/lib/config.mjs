// Single source of truth for the model id used by the agent, the trust-layer judge,
// and the key-check script. Override with ANTHROPIC_MODEL if you need to swap models.
export const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
