# AI Recap Studio — UI Prototype

This is the first frontend milestone for your personal AI Recap Studio.

## What works in this prototype
- Cinematic dark dashboard.
- Overview, Projects, Create Recap and Settings pages.
- Upload-file selection and drag-and-drop UI.
- Movie URL input UI.
- Burmese/English and short/long recap choices.
- Project creation saved in the current browser session.
- Responsive layout for desktop and mobile.

## What does not work yet
This is a frontend prototype only. It does not download or analyze movies, call an AI model, generate Burmese/English narration, create subtitles, render MP4 files, authenticate users, or store projects in a cloud database.

## Run locally on Windows
1. Extract the ZIP.
2. Open the `ai-recap-studio` folder.
3. Double-click `index.html`.

You may also run a local static server from this folder:
```bat
py -m http.server 8000
```
Then open `http://127.0.0.1:8000`.

## Next engineering milestones
1. Build a secure backend API and user authentication.
2. Add a job queue and private cloud object storage.
3. Implement a script-generation adapter and validate timestamps.
4. Evaluate Burmese-capable text-to-speech providers.
5. Build scene-to-narration alignment and subtitle timing.
6. Add FFmpeg rendering and export jobs.
7. Review DeepCut's license with its seller before deploying or incorporating its code into a cloud service.

## DeepCut source and license
This prototype is a separate frontend and does not copy or modify DeepCut source files. The supplied `LICENSE.txt` grants personal use on the purchaser's own computers and restricts redistribution and use on behalf of others without written permission. Obtain written clarification from THET × DeepLearn AI before using DeepCut code on a cloud server.
