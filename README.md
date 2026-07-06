# Final Tex ERP 2.0

A TanStack + React ERP app ready to deploy on Vercel.

## Local development

1. Install dependencies
   ```bash
   npm install
   ```
2. Start the development server
   ```bash
   npm run dev
   ```
3. Open the local URL shown by Vite.

## GitHub + Vercel deployment

1. Create a new repository on GitHub and push this project.
2. In Vercel, import the GitHub repository.
3. Use the default settings:
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `.vercel/output`
4. Deploy.

## Notes

- The app uses Google Apps Script as its backend. After the Vercel deployment is live, open the app and configure the Apps Script URL in the Setup page.
- For the first deployment, the project already includes the Vercel-ready Nitro preset in `vite.config.ts`.
- To package the app as a desktop app with your company logo as the icon, run `npm run package:desktop` after starting the dev server or pointing the build to a reachable URL.
