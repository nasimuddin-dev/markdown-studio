---
title: AI Assistant
description: Use Claude, by Anthropic, in Markpion to improve, fix, shorten, summarize, translate or continue text. Opt-in, with your own API key and a review before anything changes.
---

# AI Assistant

Markpion can ask **Claude**, Anthropic's AI model, to work on your text: improve it, fix its spelling and grammar, shorten it, summarize it, translate it, continue it, or follow your own instruction. It's **off by default**, uses **your own Anthropic API key**, and **never changes your document until you've reviewed the answer**.

The assistant is part of the desktop app. The browser demo on this website doesn't include it.

## Set it up

1. Create an API key in the [Anthropic Console](https://console.anthropic.com/) (**API keys → Create key**). Anthropic bills your account for what you use.
2. In Markpion, open **Settings → AI Assistant** and turn on **AI commands**.
3. Paste the key and choose **Save Key**. Markpion checks it with Anthropic, then stores it in **Windows Credential Manager** or the **macOS Keychain** (on Linux, in a file only your account can read, in Markpion's settings folder). It's never written to Markpion's settings file.
4. Optionally choose the **model**: Claude Opus 5.5 (most capable, the default), Claude Sonnet 5.5 (faster and cheaper), or Claude Haiku 4.5 (fastest and cheapest).

To stop using it, turn **AI commands** off, or choose **Remove Key**.

## Commands

The **AI** menu, and the command palette (search for "AI"), have these commands. They work on the **selected text**; with nothing selected, on the **paragraph at the cursor**.

| Command | What Claude does | The answer goes |
| --- | --- | --- |
| Improve Writing | Makes the text clearer, more concise and more natural, and fixes mistakes | Over the original |
| Fix Spelling and Grammar | Fixes spelling, grammar and punctuation only | Over the original |
| Make Shorter | About half as long, keeping the key points | Over the original |
| Summarize | A few sentences, or a short list | Below the original |
| Continue Writing | Writes one or two more paragraphs from the cursor, using up to 6,000 characters before it | At the cursor |
| Translate… | Translates into the language you type | Over the original |
| Ask Claude… (**Ctrl+J** / **Cmd+J**) | Follows your own instruction, such as "turn this into a table" | Over the original |

While Claude works, a message at the bottom of the window shows its progress; **Cancel** stops waiting.

## Review before anything changes

The answer opens in a review window next to the original text. You can **edit the suggestion** first, then:

- **Replace** (or **Insert** / **Insert Below**, depending on the command) puts it into the document as one edit, so **Ctrl+Z** undoes it;
- **Copy** copies it to the clipboard;
- **Discard** closes the window without changes.

If you changed the original text while Claude was working, Markpion doesn't overwrite it; copy the suggestion or run the command again.

AI can make mistakes: always check the suggestion before you use it.

## Privacy

- **Nothing is sent until you run an AI command.** The first time, Markpion asks you to confirm. After that, running a command is your consent to send that text.
- **What's sent:** the selected text or paragraph (or, for Continue Writing, the text before the cursor) and the command's instruction, directly from your computer to Anthropic's API (`api.anthropic.com`), under your key. Nothing else from your documents or your computer is sent.
- **How Anthropic handles it** is set by your agreement with Anthropic and its [privacy policy](https://www.anthropic.com/legal/privacy).
- Markpion's diagnostic log records only that a request was made, its size and whether it worked, never the text or the key.
- The key is only read by Markpion's native part; the editor interface never sees it.

## Troubleshooting

| Message | What to do |
| --- | --- |
| "The API key was rejected" | Check the key in the Anthropic Console, then save it again in Settings |
| "Your Anthropic account can't be billed" | Add credit or a payment method in the Anthropic Console |
| "Too many requests" or "Claude is busy" | Wait a moment and try again (Markpion retries twice automatically) |
| "The answer was too long" or "The selected text is too long" | Select less text (a request can include up to 200,000 characters) |
| "Couldn't reach the Claude API" | Check your internet connection and any proxy |
| "Claude declined this request" | Reword the instruction, or select different text |
