---
title: AI Assistant
description: Use Claude, by Anthropic, or a local model through Ollama in Markpion to improve, fix, shorten, summarize, translate or continue text. Opt-in, with a review before anything changes.
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

## Use a local model instead

Instead of Claude, the commands can use a model running on your own computer through [Ollama](https://ollama.com). Your text then stays on your computer, and no API key or account is needed.

1. Install Ollama and download a model, for example `ollama pull llama3.2` in a terminal. Ollama runs in the background at `http://localhost:11434`.
2. In **Settings → AI Assistant**, turn on **AI commands** and choose **A local model with Ollama**.
3. Markpion lists the models Ollama has; pick one. If Ollama runs on another port, change the **Ollama address** and choose **Connect**. Only addresses on this computer (`localhost`, `127.0.0.1`, `[::1]`) are accepted.

The same commands, review and **Stop** work as with Claude. Local models are usually slower (the first request also loads the model) and their answers less reliable, depending on the model and your computer.

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
| Write… (**Ctrl+Shift+J** / **Cmd+Shift+J**) | Writes new text from your instruction alone, such as "an introduction about our release process". **No document text is sent** | At the cursor |

The review window opens straight away and shows the answer as Claude writes it. **Stop** (or closing the window) ends the request, so Claude stops writing and nothing is applied.

## Review before anything changes

For commands that replace the text, the window shows the **Changes** first: the original and the suggestion as a diff, with the changed words marked, so a grammar fix is easy to check. It follows your edits to the suggestion. Choose **Original** to see the original text as it was.

When Claude has finished, you can **edit the suggestion**, then:

- **Replace** (or **Insert** / **Insert Below**, depending on the command) puts it into the document as one edit, so **Ctrl+Z** undoes it;
- **Copy** copies it to the clipboard;
- **Discard** closes the window without changes.

If you changed the original text while Claude was working, Markpion doesn't overwrite it; copy the suggestion or run the command again.

AI can make mistakes: always check the suggestion before you use it.

## Privacy

- **With a local model, nothing leaves your computer:** the text goes to Ollama at the address you set, which must be on this computer, and there is no consent prompt. The rest of this section is about Claude.
- **Nothing is sent until you run an AI command.** The first time, Markpion asks you to confirm. After that, running a command is your consent to send that text.
- **What's sent:** the selected text or paragraph (or, for Continue Writing, the text before the cursor; for Write, nothing but your instruction) and the command's instruction, directly from your computer to Anthropic's API (`api.anthropic.com`), under your key. Nothing else from your documents or your computer is sent.
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
