---
title: Managed Settings for IT Administrators
description: Preset and lock Markpion settings for everyone on a computer with a policy.json file, for example to turn off the AI assistant or the update check.
---

# Managed settings

IT administrators can preset Markpion's settings for everyone who uses a computer, and **lock** some of them so users can't change them in the app. For example, you can turn off the AI assistant, turn off the update check, or make exports use Letter paper.

## The policy file

Create a file named `policy.json` in this location (it needs administrator rights, so users can't change it):

| System | Location |
| --- | --- |
| Windows | `%ProgramData%\Markpion\policy.json` (usually `C:\ProgramData\Markpion\policy.json`) |
| macOS | `/Library/Application Support/Markpion/policy.json` |
| Linux | `/etc/markpion/policy.json` |

Example:

```json
{
  "settings": {
    "aiEnabled": false,
    "checkForUpdates": false,
    "exportPageSize": "letter",
    "autoSave": "afterDelay"
  },
  "locked": ["aiEnabled", "checkForUpdates"]
}
```

- **`settings`** gives default values. A user can still change a setting that isn't locked; their choice is kept.
- **`locked`** lists settings that always have the policy's value (or Markpion's built-in default, if `settings` doesn't give one). In the app they're shown as managed and can't be changed.

The keys and values are the same as in `settings.json`; see [Configuration](/reference/configuration#settings-json). The last session (`session`) can't be managed.

Markpion reads the policy when it starts. Changes take effect the next time it starts.

## Common policies

| Goal | Policy |
| --- | --- |
| No AI assistant | `"settings": { "aiEnabled": false }, "locked": ["aiEnabled"]` |
| Only a specific AI model | `"settings": { "aiModel": "claude-sonnet-5-5" }, "locked": ["aiModel"]` |
| No update check at startup (you deploy updates yourself) | `"settings": { "checkForUpdates": false }, "locked": ["checkForUpdates"]` |
| Letter paper for PDF and Word | `"settings": { "exportPageSize": "letter" }` |

Locking `checkForUpdates` stops the check at startup. To keep users on the version you deploy, also deploy new versions yourself with the [silent installer](/installation/windows#silent-install-it-administrators).

## If something is wrong

Unknown keys and invalid values are ignored, as in `settings.json`. A file that isn't valid JSON, isn't a JSON object, or is larger than 64 KB is ignored completely, and the reason is written to Markpion's diagnostic log (**Help → Export Diagnostic Logs…**, entries named `policy.load`). A valid policy is logged as "managed settings applied".
