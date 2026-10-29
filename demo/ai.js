// Prompts and links that hand a workout to an AI assistant. The site's
// "Try with Claude" buttons and the player's "Change it with AI" buttons
// share them.

// The guide for AI assistants, at an address people can read in a prompt.
// llms-full.txt holds the same text.
export const GUIDE_URL = 'https://portableworkout.org/ai/';

export const ASSISTANTS = [
  { name: 'Claude', link: (prompt) => `https://claude.ai/new?q=${encodeURIComponent(prompt)}`, home: 'https://claude.ai/new' },
  { name: 'ChatGPT', link: (prompt) => `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`, home: 'https://chatgpt.com/' },
];

// Longer links risk being cut off. Past this, the prompt is copied instead.
const MAX_LINK = 8000;

export const startPrompt = () =>
  `I’d like to make a workout with the Portable Workout Format. Read ${GUIDE_URL} first, ` +
  'then ask me what I’d like. When it’s ready, give me a link to play it.';

export const changePrompt = (doc) =>
  `Here’s a workout in the Portable Workout Format. Read ${GUIDE_URL} if you haven’t already, ` +
  'then help me change it. When we’re done, give me a new link to play it.\n\n' +
  JSON.stringify(doc);

export const fixPrompt = (problems) =>
  'The PWF player couldn’t open the workout you gave me. It found these problems:\n\n' +
  `${problems}\n\nPlease fix them and give me a new link.`;

/** The link to open an assistant with this prompt, and whether the prompt fits in it. */
export function assistantLink(assistant, prompt) {
  const link = assistant.link(prompt);
  return link.length <= MAX_LINK ? { href: link, fits: true } : { href: assistant.home, fits: false };
}

/** Copies text, resolving to whether it worked. */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Makes anchors that open each assistant with the prompt, and copy it as well
 * in case the assistant doesn't fill it in. `notify` shows a short message.
 */
export function assistantButtons(getPrompt, notify, { className = 'button', label = (name) => `Open in ${name}` } = {}) {
  return ASSISTANTS.map((assistant) => {
    const a = document.createElement('a');
    a.className = className;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = label(assistant.name);
    const refresh = () => {
      const { href } = assistantLink(assistant, getPrompt());
      a.href = href;
    };
    refresh();
    a.addEventListener('pointerdown', refresh);
    a.addEventListener('focus', refresh);
    a.addEventListener('click', () => {
      const prompt = getPrompt();
      const { fits } = assistantLink(assistant, prompt);
      copyText(prompt).then((copied) => {
        if (!fits) notify(copied ? `Copied. Paste it into ${assistant.name}.` : `Too long for a link. Use “Copy prompt” and paste it into ${assistant.name}.`);
        else if (copied) notify(`Opening ${assistant.name}. The prompt is copied too, in case it isn’t filled in.`);
      });
    });
    return a;
  });
}
