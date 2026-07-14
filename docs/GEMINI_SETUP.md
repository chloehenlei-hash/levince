# Gemini Smart Paste Setup

1. Create a Gemini API key in Google AI Studio.
2. In the invoice Apps Script project, add the repository file `apps-script/Gemini.gs` as a new script file.
3. Open **Project Settings > Script properties** and add `GEMINI_API_KEY` with the API key as its value.
4. Replace the live `Code.gs` with the updated repository version, then create a new Web App deployment version.

The key stays in Apps Script and must never be pasted into the GitHub website code. Smart Paste sends the pasted customer and invoice text to Gemini for extraction. If Gemini is unavailable, the website automatically uses its local parser instead.
